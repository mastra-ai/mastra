---
'mastra': patch
---

Added `mastra env vars set` to set an environment's variables and choose whether each one is a secret or config. For example, `mastra env vars set staging LOG_LEVEL=debug --config LOG_LEVEL` stores `LOG_LEVEL` as readable config, and `--secret KEY` stores a variable as a write-only secret.
