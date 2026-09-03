#!/usr/bin/env python3

import argparse
import base64
import sys
from pathlib import Path

import requests


def generate_image(
    base_url: str,
    prompt: str,
    output: str,
    model: str = "Qwen/Qwen-Image",
    width: int = 1024,
    height: int = 1024,
    steps: int = 50,
    true_cfg_scale: float = 4.0,
    guidance_scale: float | None = None,
    seed: int | None = None,
    negative_prompt: str | None = None,
    n: int = 1,
):
    url = f"{base_url.rstrip('/')}/v1/images/generations"

    payload = {
        "model": model,
        "prompt": prompt,
        "n": n,
        "size": f"{width}x{height}",
        "num_inference_steps": steps,
        "true_cfg_scale": true_cfg_scale,
        "response_format": "b64_json",
    }

    if guidance_scale is not None:
        payload["guidance_scale"] = guidance_scale

    if seed is not None:
        payload["seed"] = seed

    if negative_prompt:
        payload["negative_prompt"] = negative_prompt

    print(f"Server : {url}")
    print(f"Model  : {model}")
    print(f"Size   : {width}x{height}")
    print(f"Steps  : {steps}")
    print(f"Prompt : {prompt}")
    print("Generating...")

    try:
        response = requests.post(
            url,
            json=payload,
            timeout=1800,
        )
    except requests.RequestException as exc:
        print(f"Failed to connect to vLLM-Omni: {exc}", file=sys.stderr)
        sys.exit(1)

    if not response.ok:
        print(
            f"vLLM-Omni returned HTTP {response.status_code}",
            file=sys.stderr,
        )
        print(response.text, file=sys.stderr)
        sys.exit(1)

    result = response.json()

    if "data" not in result or not result["data"]:
        print("No image returned:", result, file=sys.stderr)
        sys.exit(1)

    output_path = Path(output)

    for i, image_data in enumerate(result["data"]):
        b64_data = image_data.get("b64_json")

        if not b64_data:
            print(
                f"Image #{i + 1} contains no b64_json field",
                file=sys.stderr,
            )
            continue

        image_bytes = base64.b64decode(b64_data)

        if n == 1:
            filename = output_path
        else:
            filename = output_path.with_name(
                f"{output_path.stem}_{i + 1}{output_path.suffix}"
            )

        filename.parent.mkdir(parents=True, exist_ok=True)
        filename.write_bytes(image_bytes)

        print(f"Saved: {filename}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate images using Qwen/Qwen-Image served by vLLM-Omni"
    )

    parser.add_argument(
        "prompt",
        help="Text prompt for image generation",
    )

    parser.add_argument(
        "-o",
        "--output",
        default="output.png",
        help="Output image filename (default: output.png)",
    )

    parser.add_argument(
        "--server",
        default="http://localhost:8091",
        help="vLLM-Omni server (default: http://localhost:8091)",
    )

    parser.add_argument(
        "--model",
        default="Qwen/Qwen-Image",
        help="Model name",
    )

    parser.add_argument(
        "--width",
        type=int,
        default=1024,
    )

    parser.add_argument(
        "--height",
        type=int,
        default=1024,
    )

    parser.add_argument(
        "--steps",
        type=int,
        default=20,
        help="Number of diffusion inference steps",
    )

    parser.add_argument(
        "--true-cfg-scale",
        type=float,
        default=4.0,
        help="True CFG scale",
    )

    parser.add_argument(
        "--guidance-scale",
        type=float,
        default=None,
        help="Guidance scale",
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Random seed",
    )

    parser.add_argument(
        "--negative-prompt",
        default=None,
        help="Negative prompt",
    )

    parser.add_argument(
        "-n",
        type=int,
        default=1,
        help="Number of images to generate",
    )

    args = parser.parse_args()

    generate_image(
        base_url=args.server,
        prompt=args.prompt,
        output=args.output,
        model=args.model,
        width=args.width,
        height=args.height,
        steps=args.steps,
        true_cfg_scale=args.true_cfg_scale,
        guidance_scale=args.guidance_scale,
        seed=args.seed,
        negative_prompt=args.negative_prompt,
        n=args.n,
    )


if __name__ == "__main__":
    main()