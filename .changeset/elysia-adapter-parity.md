---
'@mastra/elysia': patch
---

Added comprehensive test suite for the Elysia server adapter, bringing it on par with other adapters (Hono, Express, Fastify, Koa). Tests cover route adapter integration, SSE streaming, stream redaction, chunk serialization, abort signals, multipart form data, auth middleware, RBAC permissions, malformed JSON handling, validation error hooks, HTTP logging, MCP routes, and MCP transport.
