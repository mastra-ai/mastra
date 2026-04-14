---
'mastra': minor
---

Added `mastra server env pull [file]` command to download environment variables from a deployed Mastra Server project into a local `.env` file. This is the inverse of `mastra server env import` — useful in CI/CD pipelines where you only need a single API token and can pull all other env vars at runtime.
