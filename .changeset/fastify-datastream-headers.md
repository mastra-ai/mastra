---
'@mastra/fastify': patch
---

Fixed `@mastra/fastify` dropping response headers on streamed (`datastream-response`) routes. Auth cookies (`Set-Cookie`), redirects (`Location`), `Content-Type`, and custom headers now reach the client, so SSO login/callback, sign-in, sign-up, refresh, and logout work on Fastify. Multiple cookies are sent as separate headers, and headers set by plugins such as CORS are preserved.
