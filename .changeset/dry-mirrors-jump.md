---
'@mastra/schema-compat': patch
---

Fixes an issue when the OpenAI reasoning schema compatibility layer was calling defaultValue() as a function, which works in Zod v3 but fails in Zod v4 where defaultValue is stored directly as a value.
