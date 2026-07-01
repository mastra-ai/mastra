---
'@mastra/core': patch
'mastracode': patch
---

Fixed oversized images (>8000px) breaking LLM threads by auto-resizing them before sending to the model. Images exceeding the 8000px dimension limit are now resized proportionally using bilinear downsampling. Users are notified when an image is resized.
