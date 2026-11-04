---
'@mastra/deployer': patch
'@mastra/core': patch
---

With `server.auth` set and no `server.cors.origin`, the server no longer sends `Access-Control-Allow-Credentials: true` for every reflected origin. Credentials are now on by default only when you list allowed origins in `server.cors.origin`, or set `server.cors.credentials` yourself.
