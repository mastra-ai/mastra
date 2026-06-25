---
'@mastra/core': patch
---

Fixed images from tool results being dropped when using AI SDK v6 (`@ai-sdk/*` v3) providers. Tools that return image data via `toModelOutput` (for example screenshots) now reach the model correctly instead of arriving empty.
