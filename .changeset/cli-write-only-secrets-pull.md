---
'mastra': patch
---

`mastra env vars pull` and `mastra deploy` now handle write-only secrets. When an environment stores its secrets encrypted, the platform returns a placeholder in place of each value. Pull now lists these secrets as name-only comments instead of writing the placeholder into your env file. The deploy overwrite prompt and preflight checks no longer treat the placeholder as a real value. A deploy with workers enabled is no longer blocked when `REDIS_URL` is stored as a secret.
