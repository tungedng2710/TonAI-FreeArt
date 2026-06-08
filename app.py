"""
TonAI Image Generator API

Author: https://tungedng2710.github.io/
"""

import base64
import inspect
import io
import threading
from pathlib import Path

import torch
import uvicorn
from diffusers import DiffusionPipeline
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

DEFAULT_MODEL_ID = "Tongyi-MAI/Z-Image-Turbo"
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

_PIPELINE = None
_CURRENT_MODEL = None
_PIPELINE_LOCK = threading.Lock()
_INFERENCE_LOCK = threading.Lock()


class GenerateRequest(BaseModel):
    prompt: str = Field(..., description="Text prompt to generate an image from.")
    negative_prompt: str = Field(default="", description="Optional negative prompt.")
    width: int = Field(default=1024, ge=256, le=1536, multiple_of=16)
    height: int = Field(default=1024, ge=256, le=1536, multiple_of=16)
    num_inference_steps: int = Field(default=9, ge=1, le=30)
    guidance_scale: float = Field(default=0.0, ge=0.0, le=20.0)
    seed: int = Field(default=42, description="Use -1 for random seed.")
    model: str = Field(default="Z-Image-Turbo", description="Model to use")


class GenerateResponse(BaseModel):
    seed: int
    image_base64: str
    mime_type: str = "image/png"


def _build_pipeline(model_id: str) -> DiffusionPipeline:
    if torch.cuda.is_available():
        # Prefer bf16 on newer GPUs, fallback to fp16.
        dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
        return DiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=dtype,
            device_map="balanced",
        )

    pipe = DiffusionPipeline.from_pretrained(
        model_id,
        torch_dtype=torch.float32,
    )
    pipe.to("cpu")
    return pipe


def get_pipeline(model_name: str = "Z-Image-Turbo") -> DiffusionPipeline:
    global _PIPELINE, _CURRENT_MODEL
    
    # Map friendly names to model IDs
    model_map = {
        "Z-Image-Turbo": "Tongyi-MAI/Z-Image-Turbo",
        "FLUX.2-klein-9B": "black-forest-labs/FLUX.2-klein-9B",
    }
    
    model_id = model_map.get(model_name, "Tongyi-MAI/Z-Image-Turbo")
    
    with _PIPELINE_LOCK:
        # Rebuild pipeline if model changed
        if _PIPELINE is None or _CURRENT_MODEL != model_id:
            _PIPELINE = _build_pipeline(model_id)
            _CURRENT_MODEL = model_id
    return _PIPELINE


def _pipeline_supports_arg(pipe: DiffusionPipeline, arg_name: str) -> bool:
    try:
        parameters = inspect.signature(pipe.__call__).parameters
    except (TypeError, ValueError):
        return True

    return arg_name in parameters or any(
        parameter.kind == inspect.Parameter.VAR_KEYWORD
        for parameter in parameters.values()
    )


def _build_generation_kwargs(req: GenerateRequest, pipe: DiffusionPipeline, generator):
    kwargs = {
        "prompt": req.prompt.strip(),
        "width": int(req.width),
        "height": int(req.height),
        "num_inference_steps": int(req.num_inference_steps),
        "guidance_scale": float(req.guidance_scale),
        "generator": generator,
    }

    negative_prompt = req.negative_prompt.strip() if req.negative_prompt else ""
    if negative_prompt and _pipeline_supports_arg(pipe, "negative_prompt"):
        kwargs["negative_prompt"] = negative_prompt

    return kwargs


def _run_generation(req: GenerateRequest):
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=422, detail="Prompt is required.")

    seed = int(req.seed)
    if seed < 0:
        seed = int(torch.seed() % (2**31 - 1))

    gen_device = "cuda" if torch.cuda.is_available() else "cpu"
    generator = torch.Generator(device=gen_device).manual_seed(seed)

    pipe = get_pipeline(req.model)
    kwargs = _build_generation_kwargs(req, pipe, generator)
    with _INFERENCE_LOCK:
        image = pipe(**kwargs).images[0]

    return image, seed


DEBUG_MODE = False

app = FastAPI(title="TonAI Image Generator API", version="1.0.0")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def root():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "current_model": _CURRENT_MODEL or DEFAULT_MODEL_ID,
        "cuda_available": torch.cuda.is_available(),
    }


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    image, seed = _run_generation(req)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
    return GenerateResponse(seed=seed, image_base64=encoded)


@app.post("/generate/image")
def generate_raw(req: GenerateRequest):
    image, seed = _run_generation(req)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={"X-Used-Seed": str(seed)},
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7863)
