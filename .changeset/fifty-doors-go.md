---
'@mastra/core': patch
---

Fixed toModelOutput media type normalization for AI SDK provider compatibility. Tools returning type: 'media' image content (e.g. screenshot tools) are now correctly converted to type: 'image-data' before being sent to the model, matching what AI SDK providers like Anthropic expect at runtime.
