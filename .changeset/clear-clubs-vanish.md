---
'@mastra/schema-compat': patch
---

Fix supervisor agent tool schemas for Gemini via OpenRouter: optional properties with no Gemini-compatible type (e.g. z.any()) are now stripped from tool parameter schemas. This resolves the misleading 'required[N]: property is not defined' error when using openrouter/google/gemini-\* models as a supervisor agent (fixes #17325).
