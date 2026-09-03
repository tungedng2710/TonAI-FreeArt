# TonAI-FreeArt 🎨

A FastAPI image generation application using remote vLLM-Omni services for text-to-image generation and image editing.

🚀 **[Try the Live Demo](https://7863--main--idp--tungn197.coder.vts-ai.space/)**

## Features

- **Remote Image Generation**: Powered by Qwen-Image through vLLM-Omni
- **Image Editing**: Upload a source image and edit it with Qwen-Image-Edit
- **RESTful API**: Easy-to-use API endpoints for integration
- **Web Interface**: Built-in web UI for interactive image generation
- **Flexible Configuration**: Customizable image dimensions, inference steps, and guidance
- **Lightweight Application**: No local model or GPU is required
- **Seed Control**: Reproducible results with seed management

## Requirements

- Python 3.8+
- Access to a vLLM-Omni image generation server

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

The server will start on `http://localhost:7863`

Text-to-image requests use `VLLM_OMNI_URL`, which defaults to
`http://8091--main--frontier--idp-lab.coder.vts-ai.space`. You can also set
`VLLM_OMNI_API_KEY` and `VLLM_OMNI_TIMEOUT_SECONDS` when required by the server.

Image-edit requests use `VLLM_OMNI_EDIT_URL`, which defaults to
`https://8092--main--frontier--idp-lab.coder.vts-ai.space`. If it requires a
separate credential, set `VLLM_OMNI_EDIT_API_KEY`; otherwise it falls back to
`VLLM_OMNI_API_KEY`.

### Web Interface

Open your browser and navigate to:
```
http://localhost:7863
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
  "num_inference_steps": 20,
  "true_cfg_scale": 4.0,
  "guidance_scale": 0.0,
  "seed": 42,
  "model": "Qwen/Qwen-Image-2512",
  "n": 4
}
```

Response:
```json
{
  "seed": 42,
  "image_base64": "base64_encoded_image_data",
  "images_base64": [
    "base64_encoded_image_1",
    "base64_encoded_image_2",
    "base64_encoded_image_3",
    "base64_encoded_image_4"
  ],
  "mime_type": "image/png"
}
```

#### Edit Image

**POST** `/edit/image`

Multipart form fields:

- **image**: Source image file
- **prompt**: Edit instruction
- **negative_prompt**: Optional negative prompt
- **num_inference_steps**: Default `50`
- **true_cfg_scale**: Default `4.0`
- **seed**: Random seed (`-1` for random)
- **model**: Default `"Qwen-Image-Edit"`

Returns a PNG image with the used seed in the `X-Used-Seed` response header.

#### API Documentation

Interactive API documentation is available at:
- Swagger UI: `http://localhost:7863/docs`
- ReDoc: `http://localhost:7863/redoc`

## Configuration

### Parameters

- **prompt** (required): Text description of the image to generate
- **negative_prompt** (optional): What to avoid in the generated image
- **width**: Image width (256-1536, must be multiple of 16)
- **height**: Image height (256-1536, must be multiple of 16)
- **num_inference_steps**: Number of denoising steps (1-100)
- **true_cfg_scale**: Qwen-Image true classifier-free guidance scale (0.0-20.0)
- **guidance_scale**: Classifier-free guidance scale (0.0-20.0)
- **seed**: Random seed for reproducibility (-1 for random)
- **model**: Model identifier (default: `Qwen/Qwen-Image-2512`)
- **n**: Number of images to generate in one request (1-4, default: 1)

## Models

Currently supported models:
- **Qwen-Image** (Qwen/Qwen-Image-2512): Text-to-image generation through vLLM-Omni
- **Qwen-Image-Edit** (Qwen/Qwen-Image-Edit): Image-to-image editing

## Performance Tips

- Scale the vLLM-Omni service independently from this web application
- Reduce `num_inference_steps` for faster results (default: 20)
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
- Text-to-image powered by vLLM-Omni and Qwen-Image
- Image editing powered by vLLM-Omni and Qwen-Image-Edit

---

⭐ If you find this project useful, please consider giving it a star!
