---
"@mastra/core": patch
---

Fixed multimodal outputs (images, files) from client tools being stringified instead of properly formatted for the model.

Previously, when client tools returned multimodal content (images, files), the outputs were converted to plain text JSON strings before reaching the LLM. Now, client tools correctly transform their multimodal outputs into model-ready formats (e.g., inlineData), ensuring images and files are sent to the LLM as structured content.

Fixes #17792
