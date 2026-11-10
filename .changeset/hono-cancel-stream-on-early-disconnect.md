---
'@mastra/hono': patch
---

Fixed streaming routes that kept the response stream open when the client disconnected before the route handler returned. The stream is now stopped as soon as the request is aborted. Fixes [#29640](https://github.com/mastra-ai/mastra/issues/29640).
