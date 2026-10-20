---
'@mastra/core': patch
---

Fixed MCP tool results containing images or audio being dropped by AI SDK v5 models and rejected by AI SDK v7 models such as Amazon Bedrock (`unsupported tool content part type: image-data`). MCP media content is now passed to every model in the format it supports.
