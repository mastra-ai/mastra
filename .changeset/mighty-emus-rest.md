---
'mastra': patch
---

Improved deploy env file handling with two changes:

- **Added `--env-file` flag** to `mastra deploy` and `mastra studio deploy`. Lets you specify exactly which env file to use (e.g. `--env-file .env.staging` or `--env-file config/prod.env`).
- **Fixed ambiguous env file selection in CI.** When multiple `.env` files exist in non-interactive mode (`--yes` or `MASTRA_API_TOKEN`), deploy now requires `--env-file` instead of silently picking one.
