---
'@mastra/core': patch
---

Added JSON repair for malformed tool call arguments from LLM providers. When an LLM (e.g., Kimi/K2) generates broken JSON for tool call arguments, Mastra now attempts to fix common errors (missing quotes on property names, single quotes, trailing commas) before falling back to undefined. This reduces silent tool execution failures caused by minor JSON formatting issues. See https://github.com/mastra-ai/mastra/issues/11078
