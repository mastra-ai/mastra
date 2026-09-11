---
'@mastra/connect': patch
---

Fixed OpenAI image generation tools to send base64 images to models as multimodal image content instead of JSON text, preventing generated images from consuming the text context window. Updated the generated OpenAI tools to the current API parameters.
