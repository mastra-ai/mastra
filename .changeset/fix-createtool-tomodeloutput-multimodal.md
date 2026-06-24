---
"@mastra/core": patch
---

Tools using `toModelOutput` to return images or files now correctly deliver that multimodal content to the model. Previously, image and file outputs were silently converted to plain text before reaching providers like Gemini Vertex, causing the model to receive JSON-stringified binary data instead of the actual media.
