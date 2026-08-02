---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
---

Fixed a security issue where DELETE requests could bypass the server's body size limit.

Body size limits, both the global `server.bodySizeLimit` option and any route-specific `maxBodySize` override, were only enforced for POST, PUT, and PATCH requests. A DELETE request with a large body skipped this check entirely, so it was still read into memory in full. A malicious or misbehaving client could send DELETE requests with oversized bodies to exhaust server memory, regardless of the configured limit.

DELETE requests are now checked against the same body size limits, global and route-specific, as the other body-bearing methods.

While adding test coverage for this, we also found and fixed two related bugs that meant the body size limit wasn't being enforced at all for any method in some cases:

- **Fastify**: the configured limit was attached to the route's `config` object, which Fastify's body parser never reads. Oversized requests of any method were let through.
- **Hono**: when a custom `onError` handler was configured, its return value was passed straight through as the response instead of being wrapped in an HTTP response. This produced a broken response for any oversized request, instead of the intended `413`.
