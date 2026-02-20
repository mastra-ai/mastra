---
'@mastra/core': patch
---

Fixed multi-step tool calling dropping reasoning items for Azure OpenAI. The cache key generator now looks for itemId under any provider key in providerMetadata (not just openai), and empty reasoning parts with providerMetadata are no longer silently dropped during message conversion.
