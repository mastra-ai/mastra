---
'@mastra/hono': patch
---

Cap the request body on the raw browser-stream session-close route.

`POST {apiPrefix}/agents/:agentId/browser/close` is registered directly on the Hono app, outside the per-route `bodyLimit` the adapter applies to registered API routes, and it reads `await c.req.json()`. An authenticated caller could therefore make the server buffer an arbitrarily large JSON payload. The body only carries `{ threadId }`, so it is now capped at 4 KiB and answers `413` before parsing — the same limit the upgrade-ticket route gained for the same reason.
