---
'@mastra/schema-compat': patch
---

Fixed Azure OpenAI GPT models filling optional tool inputs with made-up values. They now leave optional inputs empty, as they already do through `@ai-sdk/openai`. Claude, DeepSeek and Meta models served through Azure behave as before.
