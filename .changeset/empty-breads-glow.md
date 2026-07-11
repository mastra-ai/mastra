---
'@mastra/hono': patch
'@mastra/server': patch
---

Fixed agent replies from channels being silently dropped on Cloudflare Workers.

Channel replies are generated after the webhook returns `200 OK`. On Cloudflare Workers that background work needs the platform `waitUntil` handle to survive past the response, but the execution context was lost inside the custom-route handling, so the worker froze on `200` and killed the in-flight run with no error logged. Custom API routes (including channel webhooks) now forward the execution context, so the reply completes and is delivered. (#19285)
