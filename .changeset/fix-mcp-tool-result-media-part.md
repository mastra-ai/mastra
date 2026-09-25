---
'@mastra/core': patch
---

Fix MCP image and audio tool results being dropped from model requests. Convert MCP content to `media` parts, the only multimodal part type valid in `LanguageModelV2ToolResultOutput`, so spec-v2 providers keep the image and the spec-v4 translation converts it to the file content shape.
