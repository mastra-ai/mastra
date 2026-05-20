---
'@mastra/mcp': patch
---

Fixed OAuth authentication failing for confidential clients. Client credentials are now correctly included in token requests. See https://github.com/mastra-ai/mastra/issues/16854
