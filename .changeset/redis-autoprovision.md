---
'mastra': minor
---

Added managed Redis autoprovisioning to `mastra deploy`. When your project bundle references `REDIS_URL` (for example a `RedisStreamsPubSub` configured with `process.env.REDIS_URL`) and the env var is missing on the target environment, the deploy preflight now offers to attach a managed Redis instance on the Mastra platform, provisions it via Railway, and injects `REDIS_URL` into the deploy in one step. You can also opt in explicitly with `mastra env db create --kind redis`. Non-interactive runs (CI, `--yes`) surface the exact `mastra env db create` command instead of silently creating infrastructure.
