---
'mastra': patch
---

Added `mastra env vars set` to set an environment's variables and choose whether they're stored as secrets or config. For example, `mastra env vars set staging LOG_LEVEL=debug --config` stores `LOG_LEVEL` as readable config, `--secret` stores every variable in the command as a write-only secret, and `mastra env vars set staging DATABASE_URL --secret` changes only how an existing variable is stored.
