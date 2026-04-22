---
'mastra': patch
---

Improved deploy env file handling for `mastra deploy` and `mastra studio deploy`:

- **Single env file selection.** Deploy now uses one env file instead of merging multiple files together. When multiple `.env` files exist, you'll be prompted to choose which one to deploy.
- **Added `--env-file` flag.** Specify exactly which env file to use (e.g. `--env-file .env.staging` or `--env-file config/prod.env`). Accepts any file path, not just `.env*` files.
- **Non-interactive mode requires `--env-file` when ambiguous.** In CI (`--yes` or `MASTRA_API_TOKEN`), deploy requires `--env-file` when multiple env files exist instead of silently picking one. A single env file is auto-selected.
