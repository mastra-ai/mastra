---
'@mastra/core': patch
'@mastra/mcp': patch
---

Added auto-detection of multimodal content in tool results. Regular tools returning content with image or audio parts are now automatically recognized and forwarded as native multimodal tool results to the model, without requiring explicit `toModelOutput` configuration.
