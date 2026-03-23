---
'@mastra/datadog': patch
---

Fixed error info tags being recorded as [object Object] in Datadog. Error details (message, id, domain, category) are now stored as separate flattened tags (error.message, error.id, error.domain, error.category) instead of a nested object, making error information properly visible in Datadog LLM Observability.
