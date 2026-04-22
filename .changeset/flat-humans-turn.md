---
'@mastra/server': patch
---

Fixed noisy 'Background task manager not available' error log in studio when background tasks are not enabled. The list endpoint now returns an empty list, the get-by-id endpoint returns 404, and the SSE stream endpoint returns an empty stream that closes on disconnect — instead of throwing an HTTP 400 that gets logged as an error.
