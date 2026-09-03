"""Remote vLLM-Omni image generation and editing engine."""

import argparse
import base64
import io
import os
import secrets
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
from PIL import Image, UnidentifiedImageError

DEFAULT_MODEL_NAME = "Qwen/Qwen-Image-2512"
DEFAULT_MODEL_ID = DEFAULT_MODEL_NAME
DEFAULT_EDIT_MODEL_NAME = "Qwen-Image-Edit"
DEFAULT_EDIT_MODEL_ID = "Qwen/Qwen-Image-Edit"
MODEL_MAP = {DEFAULT_MODEL_NAME: DEFAULT_MODEL_ID}
EDIT_MODEL_MAP = {DEFAULT_EDIT_MODEL_NAME: DEFAULT_EDIT_MODEL_ID}

DEFAULT_VLLM_OMNI_URL = (
    "http://8091--main--frontier--idp-lab.coder.vts-ai.space"
)
DEFAULT_VLLM_OMNI_EDIT_URL = (
    "https://8092--main--frontier--idp-lab.coder.vts-ai.space"
)
VLLM_OMNI_URL = os.getenv("VLLM_OMNI_URL", DEFAULT_VLLM_OMNI_URL).rstrip("/")
VLLM_OMNI_EDIT_URL = os.getenv(
    "VLLM_OMNI_EDIT_URL", DEFAULT_VLLM_OMNI_EDIT_URL
).rstrip("/")
VLLM_OMNI_API_KEY = os.getenv("VLLM_OMNI_API_KEY", "")
VLLM_OMNI_EDIT_API_KEY = os.getenv(
    "VLLM_OMNI_EDIT_API_KEY", VLLM_OMNI_API_KEY
)
VLLM_OMNI_TIMEOUT_SECONDS = float(os.getenv("VLLM_OMNI_TIMEOUT_SECONDS", "1800"))


@dataclass
class ImageGenerationRequest:
    prompt: str
    negative_prompt: str = ""
    width: int = 1024
    height: int = 1024
    num_inference_steps: int = 20
    true_cfg_scale: float = 4.0
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
    image: Image.Image
    seed: int
    model_id: str


class VLLMOmniError(RuntimeError):
    """Raised when a remote vLLM-Omni image service fails."""


class ImageGenerationEngine:
    @property
    def current_model(self) -> str:
        return DEFAULT_MODEL_ID

    @property
    def generation_server(self) -> str:
        return VLLM_OMNI_URL

    @property
    def current_edit_model(self) -> str:
        return DEFAULT_EDIT_MODEL_ID

    @property
    def edit_server(self) -> str:
        return VLLM_OMNI_EDIT_URL

    def generate(self, req: ImageGenerationRequest) -> ImageGenerationResult:
        if not req.prompt or not req.prompt.strip():
            raise ValueError("Prompt is required.")

        seed = self._resolve_seed(req.seed)
        model_id = self.resolve_model_id(req.model)
        payload = {
            "model": model_id,
            "prompt": req.prompt.strip(),
            "n": 1,
            "size": f"{int(req.width)}x{int(req.height)}",
            "num_inference_steps": int(req.num_inference_steps),
            "true_cfg_scale": float(req.true_cfg_scale),
            "guidance_scale": float(req.guidance_scale),
            "seed": seed,
            "response_format": "b64_json",
        }
        if req.negative_prompt and req.negative_prompt.strip():
            payload["negative_prompt"] = req.negative_prompt.strip()

        return ImageGenerationResult(
            image=self._request_generation(payload),
            seed=seed,
            model_id=model_id,
        )

    def edit(self, req: ImageEditRequest) -> ImageGenerationResult:
        if not req.prompt or not req.prompt.strip():
            raise ValueError("Prompt is required.")
        if req.image is None:
            raise ValueError("Source image is required.")

        seed = self._resolve_seed(req.seed)
        model_id = self.resolve_edit_model_id(req.model)
        source_images = req.image if isinstance(req.image, list) else [req.image]
        files = []

        for index, source_image in enumerate(source_images, start=1):
            if not hasattr(source_image, "save") or not hasattr(source_image, "convert"):
                raise ValueError(f"Source image #{index} is invalid.")
            buffer = io.BytesIO()
            source_image.convert("RGB").save(buffer, format="PNG")
            files.append(
                ("image", (f"image_{index}.png", buffer.getvalue(), "image/png"))
            )

        data = {
            "prompt": req.prompt.strip(),
            "model": model_id,
            "n": "1",
            "response_format": "b64_json",
            "output_format": "png",
            "num_inference_steps": str(int(req.num_inference_steps)),
            "true_cfg_scale": str(float(req.true_cfg_scale)),
            "seed": str(seed),
        }
        if req.negative_prompt is not None:
            data["negative_prompt"] = req.negative_prompt.strip() or " "

        return ImageGenerationResult(
            image=self._request_edit(data, files),
            seed=seed,
            model_id=model_id,
        )

    def preload_default_pipeline(self) -> None:
        """Compatibility no-op: image models are served remotely."""

    def preload_startup_pipelines(self) -> None:
        """Compatibility no-op: image models are served remotely."""

    def release(self) -> None:
        """Compatibility no-op: image models are served remotely."""

    @staticmethod
    def resolve_model_id(model_name: str) -> str:
        return MODEL_MAP.get(model_name, DEFAULT_MODEL_ID)

    @staticmethod
    def resolve_edit_model_id(model_name: str) -> str:
        return EDIT_MODEL_MAP.get(model_name, DEFAULT_EDIT_MODEL_ID)

    @staticmethod
    def _resolve_seed(seed: int) -> int:
        seed = int(seed)
        return secrets.randbelow(2**31 - 1) if seed < 0 else seed

    @staticmethod
    def _request_generation(payload: dict[str, Any]) -> Image.Image:
        headers = {"Content-Type": "application/json"}
        if VLLM_OMNI_API_KEY:
            headers["Authorization"] = f"Bearer {VLLM_OMNI_API_KEY}"

        try:
            response = requests.post(
                f"{VLLM_OMNI_URL}/v1/images/generations",
                json=payload,
                headers=headers,
                timeout=VLLM_OMNI_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise ImageGenerationEngine._request_error("generation", exc) from exc

        return ImageGenerationEngine._decode_image_response(response, "generation")

    @staticmethod
    def _request_edit(data: dict[str, str], files: list[tuple]) -> Image.Image:
        headers = {}
        if VLLM_OMNI_EDIT_API_KEY:
            headers["Authorization"] = f"Bearer {VLLM_OMNI_EDIT_API_KEY}"

        try:
            response = requests.post(
                f"{VLLM_OMNI_EDIT_URL}/v1/images/edits",
                data=data,
                files=files,
                headers=headers,
                timeout=VLLM_OMNI_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise ImageGenerationEngine._request_error("editing", exc) from exc

        return ImageGenerationEngine._decode_image_response(response, "editing")

    @staticmethod
    def _request_error(
        operation: str, exc: requests.RequestException
    ) -> VLLMOmniError:
        status = getattr(exc.response, "status_code", None)
        detail = f" (HTTP {status})" if status is not None else ""
        return VLLMOmniError(f"vLLM-Omni image {operation} failed{detail}.")

    @staticmethod
    def _decode_image_response(
        response: requests.Response, operation: str
    ) -> Image.Image:
        try:
            result = response.json()
            encoded = result["data"][0]["b64_json"]
            image_bytes = base64.b64decode(encoded, validate=True)
            image = Image.open(io.BytesIO(image_bytes))
            image.load()
            return image.convert("RGB")
        except (KeyError, IndexError, TypeError, ValueError, UnidentifiedImageError) as exc:
            raise VLLMOmniError(
                f"vLLM-Omni returned an invalid image {operation} response."
            ) from exc


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the TonAI generation engine.")
    parser.add_argument("--prompt", required=True, help="Text prompt to generate from.")
    parser.add_argument("--negative-prompt", default="", help="Optional negative prompt.")
    parser.add_argument("--model", default=DEFAULT_MODEL_NAME, choices=sorted(MODEL_MAP))
    parser.add_argument("--width", type=int, default=1024)
    parser.add_argument("--height", type=int, default=1024)
    parser.add_argument("--steps", type=int, default=20)
    parser.add_argument("--true-cfg-scale", type=float, default=4.0)
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
            true_cfg_scale=args.true_cfg_scale,
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
