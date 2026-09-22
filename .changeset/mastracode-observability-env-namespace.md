---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed Mastra Code exporting its own traces into whichever Mastra project's `.env` it was launched from, and crashing on startup when that project's `MASTRA_PROJECT_ID` was not a valid id. Mastra Code cloud observability now only reads its own environment variables (or the `/observability connect` settings) and ignores `MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT` from the environment.

If you configured Mastra Code cloud observability through environment variables, rename them:

```sh
# before
export MASTRA_CLOUD_ACCESS_TOKEN=...
export MASTRA_PROJECT_ID=...

# after
export MASTRACODE_CLOUD_ACCESS_TOKEN=...
export MASTRACODE_PROJECT_ID=...
```
