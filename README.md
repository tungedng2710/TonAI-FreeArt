# TonAI-FreeArt 🎨

A fast and efficient AI-powered image generation API built with FastAPI and Diffusion Models. Generate high-quality images from text prompts using state-of-the-art diffusion models.

## Features

- **Fast Image Generation**: Powered by Z-Image-Turbo diffusion model
- **RESTful API**: Easy-to-use API endpoints for integration
- **Web Interface**: Built-in web UI for interactive image generation
- **Flexible Configuration**: Customizable image dimensions, inference steps, and guidance
- **GPU Acceleration**: Optimized for CUDA-enabled GPUs
- **Seed Control**: Reproducible results with seed management

## Requirements

- Python 3.8+
- CUDA-compatible GPU (recommended)
- At least 8GB VRAM for optimal performance

## Installation

1. Clone the repository:
```bash
git clone https://github.com/tungedng2710/TonAI-FreeArt.git
cd TonAI-FreeArt
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Starting the Server

Run the FastAPI server:
```bash
python app.py
```

The server will start on `http://localhost:8000`

### Web Interface

Open your browser and navigate to:
```
http://localhost:8000
```

### API Endpoints

#### Generate Image

**POST** `/generate`

Request body:
```json
{
  "prompt": "a beautiful sunset over mountains",
  "negative_prompt": "",
  "width": 1024,
  "height": 1024,
  "num_inference_steps": 9,
  "guidance_scale": 0.0,
  "seed": 42,
  "model": "Z-Image-Turbo"
}
```

Response:
```json
{
  "seed": 42,
  "image_base64": "base64_encoded_image_data",
  "mime_type": "image/png"
}
```

#### API Documentation

Interactive API documentation is available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Configuration

### Parameters

- **prompt** (required): Text description of the image to generate
- **negative_prompt** (optional): What to avoid in the generated image
- **width**: Image width (256-1536, must be multiple of 16)
- **height**: Image height (256-1536, must be multiple of 16)
- **num_inference_steps**: Number of denoising steps (1-30)
- **guidance_scale**: Classifier-free guidance scale (0.0-20.0)
- **seed**: Random seed for reproducibility (-1 for random)
- **model**: Model identifier (default: "Z-Image-Turbo")

## Models

Currently supported models:
- **Z-Image-Turbo** (Tongyi-MAI/Z-Image-Turbo): Fast, high-quality image generation

## Performance Tips

- Use GPU acceleration for faster generation
- Reduce `num_inference_steps` for faster results (default: 9)
- Set `guidance_scale` to 0.0 for Turbo models
- Use smaller image dimensions for quicker generation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**tungedng2710**

- GitHub: [@tungedng2710](https://github.com/tungedng2710)
- Website: [https://tungedng2710.github.io/](https://tungedng2710.github.io/)

## Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/)
- Powered by [Hugging Face Diffusers](https://github.com/huggingface/diffusers)
- Model: [Tongyi-MAI/Z-Image-Turbo](https://huggingface.co/Tongyi-MAI/Z-Image-Turbo)

---

⭐ If you find this project useful, please consider giving it a star!
