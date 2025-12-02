## Different Types of Vision Language Models

Vision language models come in three types:

- **Base:** Pre-trained models that can be fine-tuned. A good example of base models is the [PaliGemma models family](https://huggingface.co/models?sort=trending&search=google%2Fpaligemma-3b-pt) by Google.
- **Instruction:** Base models fine-tuned on instruction datasets. A good example of instruction fine-tuned models is [idefics2-8b](https://huggingface.co/HuggingFaceM4/idefics2-8b).
- **Chatty/Conversational:** Base models fine-tuned on conversation datasets. A good example of chatty models is [deepseek-vl-7b-chat](https://huggingface.co/deepseek-ai/deepseek-vl-7b-chat).

![VLM uses](https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/blog/vlm/visual.jpg)

## Use Cases

### Multimodal Dialogue

Vision language models can be used as multimodal assistants, keeping context about the conversation and keeping the image to have multiple-turn dialogues.

### Zero-shot Object Detection, Image Segmentation and Localization

Some vision language models can detect or segment a set of objects or describe the positions or relative positions of the objects. For example, one could prompt such a model to ask if one object is behind another. Such a model can also output bounding box coordination or segmentation masks directly in the text output, unlike the traditional models explicitly trained on only object detection or image segmentation.

### Visual Question Answering

Vision language models trained on image-text pairs can be used for visual question answering and generating captions for images.

### Document Question Answering and Retrieval

Documents often consist of different layouts, charts, tables, images, and more. Vision language models trained on formatted documents can extract information from them. This is an OCR-free approach; the inputs skip OCR, and documents are directly fed to vision language models.

### Image Recognition with Instructions

Vision language models can recognize images through descriptions. When given detailed descriptions of specific entities, it can classify the entities in an image.

## Inference

You can use the Transformers library to interact with vision-language models. You can load the model like below.

```python
from transformers import LlavaNextProcessor, LlavaNextForConditionalGeneration
import torch

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
processor = LlavaNextProcessor.from_pretrained("llava-hf/llava-v1.6-mistral-7b-hf")
model = LlavaNextForConditionalGeneration.from_pretrained(
    "llava-hf/llava-v1.6-mistral-7b-hf",
    torch_dtype=torch.float16
)
model.to(device)
```

We can infer by passing image and text dialogues.

```python
from PIL import Image
import requests

# image of a radar chart
url = "https://github.com/haotian-liu/LLaVA/blob/1a91fc274d7c35a9b50b3cb29c4247ae5837ce39/images/llava_v1_5_radar.jpg?raw=true"
image = Image.open(requests.get(url, stream=True).raw)
prompt = "[INST] <image>\nWhat is shown in this image? [/INST]"

inputs = processor(prompt, image, return_tensors="pt").to(device)
output = model.generate(**inputs, max_new_tokens=100)

print(processor.decode(output[0], skip_special_tokens=True))
# The image appears to be a radar chart, which is a type of multivariate chart that displays values for multiple variables represented on axes
# starting from the same point. This particular radar chart is showing the performance of different models or systems across various metrics.
# The axes represent different metrics or benchmarks, such as MM-Vet, MM-Vet, MM-Vet, MM-Vet, MM-Vet, MM-V
```

## Useful Resources

- [Vision Language Models Explained](https://huggingface.co/blog/vlms)
- [Open-source Multimodality and How to Achieve it using Hugging Face](https://www.youtube.com/watch?v=IoGaGfU1CIg&t=601s)
- [Introducing Idefics2: A Powerful 8B Vision-Language Model for the community](https://huggingface.co/blog/idefics2)
- [Image-text-to-text task guide](https://huggingface.co/tasks/image-text-to-text)
- [Preference Optimization for Vision Language Models with TRL](https://huggingface.co/blog/dpo_vlm)
