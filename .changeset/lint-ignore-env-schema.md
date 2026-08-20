---
'mastra': patch
---

Ignore `.env.schema` (varlock) when discovering deploy env files. `mastra lint` no longer lints against `.env.schema`, and `mastra deploy` no longer offers it in the env file selector.
