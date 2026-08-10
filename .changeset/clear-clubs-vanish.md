---
'@mastra/schema-compat': patch
---

Fix supervisor agent tool schemas for Gemini via OpenRouter. Properties with no Gemini-compatible type — most commonly `z.any()`, which serializes to an empty schema — are now rewritten into a permissive `anyOf` instead of being dropped. This resolves the misleading `required[N]: property is not defined` error when using Gemini models through OpenRouter as a supervisor agent (fixes #17325), while keeping fields the model is expected to fill (such as `resumeData` for tool suspend/resume) present in the tool contract.
