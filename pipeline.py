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
                                         device_map="balanced")
device = "cuda"
prompt = "一张中景手机自拍照片拍摄了一位留着长黑发的年轻东亚女子在灯光明亮的电梯内对着镜子自拍。她穿着一件带有白色花朵图案的黑色露肩短上衣和深色牛仔裤。她的头微微倾斜，嘴唇嘟起做亲吻状，非常可爱俏皮。她右手拿着一部深灰色智能手机，遮住了部分脸，后置摄像头镜头对着镜子"
# input_image = load_image("https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/diffusers/cat.png")
# image = pipe(image=input_image, prompt=prompt).images[0]

image = pipe(
    prompt=prompt,
    height=1024,
    width=1024,
    guidance_scale=1.0,
    num_inference_steps=9,
    generator=torch.Generator(device=device).manual_seed(0)
).images[0]

image.save("example.png")