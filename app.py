"""
TonAI Image Generator API

Author: https://tungedng2710.github.io/
"""

import base64
import io
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from engine import DEFAULT_MODEL_NAME, ImageGenerationEngine, ImageGenerationRequest

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
ENGINE = ImageGenerationEngine()


class GenerateRequest(BaseModel):
    prompt: str = Field(..., description="Text prompt to generate an image from.")
    negative_prompt: str = Field(default="", description="Optional negative prompt.")
    width: int = Field(default=1024, ge=256, le=1536, multiple_of=16)
    height: int = Field(default=1024, ge=256, le=1536, multiple_of=16)
    num_inference_steps: int = Field(default=9, ge=1, le=30)
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
                guidance_scale=req.guidance_scale,
                seed=req.seed,
                model=req.model,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return result.image, result.seed


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
        "current_model": ENGINE.current_model,
        "cuda_available": ENGINE.cuda_available,
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
