---
'@mastra/elysia': patch
---

Fixed the Elysia adapter's body size limit for streamed requests.

- The limit now applies to every content type, including `text/plain` and `application/octet-stream`, when a request has no `Content-Length` header.
- Bodies are read only up to the limit before being rejected, instead of in full.
- Oversized requests get `413` before authentication, so an oversized unauthenticated request now gets `413` instead of `401`. This matches the Hono adapter.
