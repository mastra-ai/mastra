---
'@mastra/core': patch
---

Fixed replay of OpenAI-hosted `tool_search` across turns. Completed hosted searches no longer produce duplicate item references, orphaned outputs, or missing arguments in the Responses API. When replay metadata is missing, Mastra drops the hosted search so the model can rediscover the tool.
