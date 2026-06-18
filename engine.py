"""
TonAI image generation engine.

This module is independent from the FastAPI app. It can be imported by any
caller, or run directly from the command line to generate one image.
"""

import argparse
import gc
import inspect
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import torch
from diffusers import DiffusionPipeline

DEFAULT_MODEL_NAME = "Z-Image-Turbo"
DEFAULT_MODEL_ID = "Tongyi-MAI/Z-Image-Turbo"
DEFAULT_EDIT_MODEL_NAME = "Qwen-Image-Edit"
DEFAULT_EDIT_MODEL_ID = "Qwen/Qwen-Image-Edit"
MODEL_MAP = {
    "Z-Image-Turbo": DEFAULT_MODEL_ID,
    "FLUX.2-klein-9B": "black-forest-labs/FLUX.2-klein-9B",
    "FLUX.2-dev": "black-forest-labs/FLUX.2-dev",
}
EDIT_MODEL_MAP = {
    DEFAULT_EDIT_MODEL_NAME: DEFAULT_EDIT_MODEL_ID,
}
MODEL_MIN_GPU_MEMORY_GIB = {
    DEFAULT_MODEL_ID: 24,
    MODEL_MAP["FLUX.2-klein-9B"]: 50,
    MODEL_MAP["FLUX.2-dev"]: 50,
    DEFAULT_EDIT_MODEL_ID: 24,
}
PRELOAD_BOTH_MODELS_MIN_GIB = 80
MODEL_CPU_OFFLOAD = os.getenv("TONAI_MODEL_CPU_OFFLOAD", "").lower() in {
    "1",
    "true",
    "yes",
}


@dataclass
class ImageGenerationRequest:
    prompt: str
    negative_prompt: str = ""
    width: int = 1024
    height: int = 1024
    num_inference_steps: int = 9
    guidance_scale: float = 0.0
    seed: int = 42
    model: str = DEFAULT_MODEL_NAME


@dataclass
class ImageEditRequest:
    image: Any
    prompt: str
    negative_prompt: str = " "
    num_inference_steps: int = 50
    true_cfg_scale: float = 4.0
    seed: int = 42
    model: str = DEFAULT_EDIT_MODEL_NAME


@dataclass
class ImageGenerationResult:
    image: Any
    seed: int
    model_id: str


class ImageGenerationEngine:
    def __init__(self) -> None:
        self._generation_pipeline = None
        self._generation_model = None
        self._edit_pipeline = None
        self._edit_model = None
        self._pipeline_lock = threading.Lock()
        self._inference_lock = threading.Lock()

    @property
    def current_model(self) -> str:
        return self._generation_model or DEFAULT_MODEL_ID

    @property
    def current_edit_model(self) -> str | None:
        return self._edit_model

    @property
    def cuda_available(self) -> bool:
        return torch.cuda.is_available()

    def generate(self, req: ImageGenerationRequest) -> ImageGenerationResult:
        if not req.prompt or not req.prompt.strip():
            raise ValueError("Prompt is required.")

        seed = self._resolve_seed(req.seed)
        generator = torch.Generator(device=self._generator_device()).manual_seed(seed)
        model_id = self.resolve_model_id(req.model)
        pipe = self.get_pipeline(req.model)
        kwargs = self._build_generation_kwargs(req, pipe, generator)

        with self._inference_lock:
            with torch.inference_mode():
                image = pipe(**kwargs).images[0]

        return ImageGenerationResult(
            image=image,
            seed=seed,
            model_id=model_id,
        )

    def edit(self, req: ImageEditRequest) -> ImageGenerationResult:
        if not req.prompt or not req.prompt.strip():
            raise ValueError("Prompt is required.")
        if req.image is None:
            raise ValueError("Source image is required.")

        seed = self._resolve_seed(req.seed)
        generator = torch.manual_seed(seed)
        model_id = self.resolve_edit_model_id(req.model)
        pipe = self.get_edit_pipeline(req.model)
        kwargs = self._build_edit_kwargs(req, pipe, generator)

        with self._inference_lock:
            with torch.inference_mode():
                image = pipe(**kwargs).images[0]

        return ImageGenerationResult(
            image=image,
            seed=seed,
            model_id=model_id,
        )

    def get_pipeline(self, model_name: str = DEFAULT_MODEL_NAME) -> DiffusionPipeline:
        model_id = self.resolve_model_id(model_name)

        with self._pipeline_lock:
            if self._generation_pipeline is None or self._generation_model != model_id:
                self._release_generation_pipeline()
                self._generation_pipeline = self._build_pipeline(model_id)
                self._generation_model = model_id
        return self._generation_pipeline

    def get_edit_pipeline(self, model_name: str = DEFAULT_EDIT_MODEL_NAME):
        model_id = self.resolve_edit_model_id(model_name)

        with self._pipeline_lock:
            if self._edit_pipeline is None or self._edit_model != model_id:
                self._release_edit_pipeline()
                self._edit_pipeline = self._build_edit_pipeline(model_id)
                self._edit_model = model_id
        return self._edit_pipeline

    def preload_default_pipeline(self) -> None:
        self.get_pipeline(DEFAULT_MODEL_NAME)

    def preload_startup_pipelines(self) -> None:
        if not torch.cuda.is_available():
            self.preload_default_pipeline()
            return

        total_gpu_memory_gib = self._gpu_memory_gib()
        self.preload_default_pipeline()

        if total_gpu_memory_gib > PRELOAD_BOTH_MODELS_MIN_GIB:
            self.get_edit_pipeline(DEFAULT_EDIT_MODEL_NAME)

    def release(self) -> None:
        self._release_generation_pipeline()
        self._release_edit_pipeline()
        self._clear_memory()

    def _release_generation_pipeline(self) -> None:
        if self._generation_pipeline is None:
            return

        old_pipeline = self._generation_pipeline
        self._generation_pipeline = None
        self._generation_model = None
        del old_pipeline

    def _release_edit_pipeline(self) -> None:
        if self._edit_pipeline is None:
            return

        old_pipeline = self._edit_pipeline
        self._edit_pipeline = None
        self._edit_model = None
        del old_pipeline

    @staticmethod
    def _clear_memory() -> None:
        gc.collect()

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    @staticmethod
    def resolve_model_id(model_name: str) -> str:
        return MODEL_MAP.get(model_name, DEFAULT_MODEL_ID)

    @staticmethod
    def resolve_edit_model_id(model_name: str) -> str:
        return EDIT_MODEL_MAP.get(model_name, DEFAULT_EDIT_MODEL_ID)

    @staticmethod
    def _resolve_seed(seed: int) -> int:
        seed = int(seed)
        if seed < 0:
            return int(torch.seed() % (2**31 - 1))
        return seed

    @staticmethod
    def _generator_device() -> str:
        return "cuda" if torch.cuda.is_available() else "cpu"

    def _build_pipeline(self, model_id: str) -> DiffusionPipeline:
        if torch.cuda.is_available():
            dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
            pipe = DiffusionPipeline.from_pretrained(
                model_id,
                torch_dtype=dtype,
            )
            if self._should_cpu_offload(model_id):
                if hasattr(pipe, "enable_model_cpu_offload"):
                    pipe.enable_model_cpu_offload()
                else:
                    pipe.enable_sequential_cpu_offload()
                return pipe

            pipe.to("cuda")
            return pipe

        pipe = DiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float32,
        )
        pipe.to("cpu")
        return pipe

    def _build_edit_pipeline(self, model_id: str):
        try:
            from diffusers import QwenImageEditPipeline
        except ImportError as exc:
            raise ValueError(
                "QwenImageEditPipeline is not available. Install the diffusers "
                "version that includes Qwen image editing support."
            ) from exc

        if torch.cuda.is_available():
            dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
            pipe = QwenImageEditPipeline.from_pretrained(
                model_id,
                torch_dtype=dtype,
            )
            if self._should_cpu_offload(model_id):
                if hasattr(pipe, "enable_model_cpu_offload"):
                    pipe.enable_model_cpu_offload()
                else:
                    pipe.enable_sequential_cpu_offload()
                return pipe

            pipe.to("cuda")
            return pipe

        pipe = QwenImageEditPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float32,
        )
        pipe.to("cpu")
        return pipe

    @classmethod
    def _should_cpu_offload(cls, model_id: str) -> bool:
        if MODEL_CPU_OFFLOAD:
            return True

        required_gib = MODEL_MIN_GPU_MEMORY_GIB.get(model_id, 24)
        return cls._gpu_memory_gib() < required_gib

    @staticmethod
    def _gpu_memory_gib() -> int:
        _, total_bytes = torch.cuda.mem_get_info()
        return round(total_bytes / (1024**3))

    def _build_generation_kwargs(
        self,
        req: ImageGenerationRequest,
        pipe: DiffusionPipeline,
        generator,
    ) -> dict[str, Any]:
        kwargs = {
            "prompt": req.prompt.strip(),
            "width": int(req.width),
            "height": int(req.height),
            "num_inference_steps": int(req.num_inference_steps),
            "guidance_scale": float(req.guidance_scale),
            "generator": generator,
        }

        negative_prompt = req.negative_prompt.strip() if req.negative_prompt else ""
        if negative_prompt and self._pipeline_supports_arg(pipe, "negative_prompt"):
            kwargs["negative_prompt"] = negative_prompt

        return kwargs

    def _build_edit_kwargs(
        self,
        req: ImageEditRequest,
        pipe,
        generator,
    ) -> dict[str, Any]:
        image = req.image.convert("RGB") if hasattr(req.image, "convert") else req.image
        kwargs = {
            "image": image,
            "prompt": req.prompt.strip(),
            "generator": generator,
            "num_inference_steps": int(req.num_inference_steps),
        }

        negative_prompt = req.negative_prompt if req.negative_prompt is not None else " "
        if self._pipeline_supports_arg(pipe, "negative_prompt"):
            kwargs["negative_prompt"] = negative_prompt.strip() or " "

        if self._pipeline_supports_arg(pipe, "true_cfg_scale"):
            kwargs["true_cfg_scale"] = float(req.true_cfg_scale)
        elif self._pipeline_supports_arg(pipe, "guidance_scale"):
            kwargs["guidance_scale"] = float(req.true_cfg_scale)

        return kwargs

    @staticmethod
    def _pipeline_supports_arg(pipe: DiffusionPipeline, arg_name: str) -> bool:
        try:
            parameters = inspect.signature(pipe.__call__).parameters
        except (TypeError, ValueError):
            return True

        return arg_name in parameters or any(
            parameter.kind == inspect.Parameter.VAR_KEYWORD
            for parameter in parameters.values()
        )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the TonAI generation engine.")
    parser.add_argument("--prompt", required=True, help="Text prompt to generate from.")
    parser.add_argument("--negative-prompt", default="", help="Optional negative prompt.")
    parser.add_argument("--model", default=DEFAULT_MODEL_NAME, choices=sorted(MODEL_MAP))
    parser.add_argument("--width", type=int, default=1024)
    parser.add_argument("--height", type=int, default=1024)
    parser.add_argument("--steps", type=int, default=9)
    parser.add_argument("--guidance", type=float, default=0.0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", default="output.png", help="Path to write the PNG.")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    engine = ImageGenerationEngine()
    result = engine.generate(
        ImageGenerationRequest(
            prompt=args.prompt,
            negative_prompt=args.negative_prompt,
            width=args.width,
            height=args.height,
            num_inference_steps=args.steps,
            guidance_scale=args.guidance,
            seed=args.seed,
            model=args.model,
        )
    )

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    result.image.save(output, format="PNG")
    print(f"Saved {output} with seed {result.seed} using {result.model_id}")


if __name__ == "__main__":
    main()
