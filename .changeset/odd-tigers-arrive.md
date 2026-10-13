---
'@mastra/hono': patch
---

Fixed renewed session cookies being dropped on custom API routes. Routes registered with `registerApiRoute` now return the refreshed session cookie, so signed-in users stay signed in.
