---
'mastra': patch
---

Fix `mastra studio` command to properly replace template placeholders in index.html. Previously, placeholders like `%%MASTRA_STUDIO_BASE_PATH%%` were not being replaced, causing asset loading failures and broken URLs. The studio server now transforms the HTML at startup and handles the `/refresh-events` SSE endpoint to prevent connection errors.
