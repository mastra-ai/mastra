---
'@mastra/observability': patch
---

Fixed OpenRouter pricing lookup failing when the responseModel has different word ordering than the user-configured model alias (e.g. claude-sonnet-4-6 vs claude-4.6-sonnet). The pricing registry now uses the configured model string for OpenRouter instead of the provider-returned responseModel.
