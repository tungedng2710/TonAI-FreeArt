"""
TonAI Image Generator API

Author: https://tungedng2710.github.io/
"""

import base64
import io
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

from engine import (
    DEFAULT_EDIT_MODEL_NAME,
    DEFAULT_MODEL_NAME,
    ImageEditRequest,
    ImageGenerationEngine,
    ImageGenerationRequest,
    VLLMOmniError,
)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
ENGINE = ImageGenerationEngine()


class GenerateRequest(BaseModel):
    prompt: str = Field(..., description="Text prompt to generate an image from.")
    negative_prompt: str = Field(default="", description="Optional negative prompt.")
    width: int = Field(default=1024, ge=256, le=1536, multiple_of=16)
    height: int = Field(default=1024, ge=256, le=1536, multiple_of=16)
    num_inference_steps: int = Field(default=20, ge=1, le=100)
    true_cfg_scale: float = Field(default=4.0, ge=0.0, le=20.0)
    guidance_scale: float = Field(default=0.0, ge=0.0, le=20.0)
    seed: int = Field(default=42, description="Use -1 for random seed.")
    model: str = Field(default=DEFAULT_MODEL_NAME, description="Model to use")


class GenerateResponse(BaseModel):
    seed: int
    image_base64: str
    mime_type: str = "image/png"


def _run_generation(req: GenerateRequest):
    try:
        result = ENGINE.generate(
            ImageGenerationRequest(
                prompt=req.prompt,
                negative_prompt=req.negative_prompt,
                width=req.width,
                height=req.height,
                num_inference_steps=req.num_inference_steps,
                true_cfg_scale=req.true_cfg_scale,
                guidance_scale=req.guidance_scale,
                seed=req.seed,
                model=req.model,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except VLLMOmniError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return result.image, result.seed


def _run_edit(req: ImageEditRequest):
    try:
        result = ENGINE.edit(req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return result.image, result.seed


def _read_upload_image(file: UploadFile):
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Uploaded file must be an image.")

    try:
        data = file.file.read()
        image = Image.open(io.BytesIO(data)).convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail="Could not read uploaded image.") from exc

    return image


DEBUG_MODE = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    ENGINE.preload_startup_pipelines()
    yield


app = FastAPI(title="TonAI Image Generator API", version="1.0.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def root():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return FileResponse(STATIC_DIR / "favicon.ico", media_type="image/x-icon")


@app.get("/sw.js", include_in_schema=False)
def service_worker():
    return FileResponse(
        STATIC_DIR / "sw.js",
        media_type="application/javascript",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "current_model": ENGINE.current_model,
        "generation_backend": "vllm-omni",
        "generation_server": ENGINE.generation_server,
        "current_edit_model": ENGINE.current_edit_model,
        "cuda_available": ENGINE.cuda_available,
        "image_edit_model": DEFAULT_EDIT_MODEL_NAME,
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


@app.post("/edit/image")
def edit_raw(
    images: Annotated[list[UploadFile], File(max_length=2)],
    prompt: str = Form(...),
    negative_prompt: str = Form(" "),
    num_inference_steps: int = Form(50, ge=1, le=100),
    true_cfg_scale: float = Form(4.0, ge=0.0, le=20.0),
    seed: int = Form(42),
    model: str = Form(DEFAULT_EDIT_MODEL_NAME),
):
    if not images:
        raise HTTPException(status_code=400, detail="At least one source image is required.")

    source_images = [_read_upload_image(image) for image in images]
    source_image = source_images if len(source_images) > 1 else source_images[0]
    output_image, used_seed = _run_edit(
        ImageEditRequest(
            image=source_image,
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=num_inference_steps,
            true_cfg_scale=true_cfg_scale,
            seed=seed,
            model=model,
        )
    )

    buf = io.BytesIO()
    output_image.save(buf, format="PNG")
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={"X-Used-Seed": str(used_seed)},
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7863)
