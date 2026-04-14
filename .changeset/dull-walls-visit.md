---
'mastra': minor
---

Added `mastra server env pull [file]` command. Downloads environment variables from a deployed Mastra Server project into a local `.env` file. This is the inverse of `mastra server env import` and is useful in automated pipelines where you authenticate with a single API token and pull all other variables at runtime.
