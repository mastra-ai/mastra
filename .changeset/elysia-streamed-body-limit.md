---
'@mastra/elysia': patch
---

Fixed the Elysia adapter's body size limit so it now covers streamed requests. Before, a body sent without a `Content-Length` header (chunked transfer) could skip the limit for `text/plain`, `application/octet-stream` and other non-JSON types: the route handler ran no matter how large the body was. Every body was also read in full before the limit was checked, including on unauthenticated requests. The limit is now enforced while the body is read, for every content type. Oversized requests get a `413` after reading at most the limit, and that check runs before authentication, matching the Hono adapter.
