---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed Mastra Code exporting its own traces into whichever Mastra project's `.env` it was launched from, and crashing on startup when that project's `MASTRA_PROJECT_ID` was not a valid id. Mastra Code cloud observability now only reads `MASTRACODE_CLOUD_ACCESS_TOKEN` and `MASTRACODE_PROJECT_ID` (or the `/observability connect` settings).
