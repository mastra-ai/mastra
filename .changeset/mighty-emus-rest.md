---
'mastra': patch
---

Improved env file handling for `mastra server deploy` and `mastra studio deploy`. Deploy now selects a single env file instead of silently merging multiple files. When multiple `.env` files exist, you are prompted to choose one. Added `--env-file` to specify the file directly (e.g. `--env-file .env.staging`), which is required in non-interactive mode when multiple env files are present.
