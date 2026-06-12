---
'@mastra/core': patch
---

Multimodal content returned from `toModelOutput` (e.g. images via `type: 'image-url'`) is now correctly preserved as native provider content instead of being stringified into a JSON string. Previously, tools returning `{ type: 'content', value: [...] }` with image parts would cause providers like OpenRouter and Mistral to receive a plain text string instead of multimodal content.
