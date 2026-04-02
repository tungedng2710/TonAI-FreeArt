# import torch
# from diffusers import DiffusionPipeline

# pipe = DiffusionPipeline.from_pretrained(
#     "Tongyi-MAI/Z-Image-Turbo",
#     torch_dtype=torch.bfloat16,
#     device_map="balanced",   # or "auto"
# )

# print(pipe.hf_device_map)    # verify modules are split across cuda:0 and cuda:1

# prompt = "a fat cat"

# # 2. Generate Image
# image = pipe(
#     prompt=prompt,
#     height=1024,
#     width=1024,
#     num_inference_steps=9,  # This actually results in 8 DiT forwards
#     guidance_scale=0.0,     # Guidance should be 0 for the Turbo models
#     generator=torch.Generator("cuda").manual_seed(42),
# ).images[0]

# image.save("example.png")

import torch
from diffusers import DiffusionPipeline
from diffusers.utils import load_image

pipe = DiffusionPipeline.from_pretrained("black-forest-labs/FLUX.2-klein-9B",
                                         dtype=torch.bfloat16,
                                         device_map="balanced")

prompt = "Turn this cat into a dog"
input_image = load_image("https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/diffusers/cat.png")

image = pipe(image=input_image, prompt=prompt).images[0]