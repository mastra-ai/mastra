---
'@mastra/client-js': patch
---

Stopped retrying requests that fail with 501 Not Implemented. The server returns 501 when the configured storage does not support an API, so retrying only added repeated failed requests and server error logs.
