---
'@mastra/elysia': patch
---

Fixed route-specific oversized-request rejection before handler execution and preserved explicitly attached HTTP exception responses. When a host parser has already consumed a request without `Content-Length`, the route limit remains a post-parse safeguard.
