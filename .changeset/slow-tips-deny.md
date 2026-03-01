---
'@mastra/core': patch
---

Fixed harness getTokenUsage() returning zeros when using AI SDK v5/v6. The token usage extraction now correctly reads both inputTokens/outputTokens (v5/v6) and promptTokens/completionTokens (v4) field names from the usage object.
