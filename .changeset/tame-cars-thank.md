---
'@mastra/schema-compat': patch
---

Improves provider schema compatibility for structured outputs and tool calls. OpenAI-compatible providers now emit nullable optional fields using `anyOf` instead of JSON Schema type arrays, and date-like fields from supported providers are validated more reliably when models return ISO date strings.
