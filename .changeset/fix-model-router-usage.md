---
'@mastra/core': patch
---

Fix doGenerate() in AISDKV5LanguageModel and AISDKV6LanguageModel to spread all properties from the underlying model result instead of only returning request, response, and stream. This preserves usage, finishReason, and other metadata required by ModelRouterLanguageModel.

