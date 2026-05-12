---
'@mastra/playground-ui': patch
---

Restored auto-refresh on the traces list page, polling every 10 seconds. Polling is paused while the request is forbidden (HTTP 403) to avoid flicker.
