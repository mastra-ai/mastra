---
'@mastra/core': patch
---

Auto-resize oversized images (>8000px) before sending to the LLM API. Images exceeding the 8000px dimension limit are now resized proportionally (pure-JS, via jpeg-js/pngjs) as a safety net in the prompt pipeline. Oversized images that cannot be resized (unsupported formats) are dropped to prevent API errors.
