---
'@mastra/hono': patch
---

Fixed oversized requests to the browser session-close endpoint being buffered instead of rejected.

`POST {apiPrefix}/agents/:agentId/browser/close` now rejects request bodies larger than 4 KiB with `413` before parsing them, so an authenticated caller can no longer make the server buffer an arbitrarily large payload. The body only carries a thread id, so supported callers are unaffected.
