---
'@mastra/server': patch
---

Fixed workspace filesystem permission errors returning HTTP 500 instead of 403. Permission denied errors now return the correct status code, preventing unnecessary client-side retries.
