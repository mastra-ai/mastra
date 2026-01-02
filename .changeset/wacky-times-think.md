---
'@mastra/express': patch
'@mastra/hono': patch
'@mastra/server': patch
---

fix: remove explicit Transfer-Encoding header to prevent duplicate headers in Bun runtime

Removes explicit `Transfer-Encoding: chunked` header from streaming responses. When deploying with Bun (via `bun compile`), the runtime automatically adds this header for `ReadableStream` responses. Setting it explicitly caused duplicate headers, which broke HTTP protocol compliance and resulted in 502 errors.

Node.js runtimes will continue to automatically add the `Transfer-Encoding` header for chunked responses, so this change has no impact on Node.js deployments.

Affected locations:
- `@mastra/hono`: `stream()` method no longer sets `Transfer-Encoding` header
- `@mastra/express`: `stream()` method no longer sets `Transfer-Encoding` header  
- `@mastra/server`: `toTextStreamResponse()` and `toDataStreamResponse()` calls in agent handlers no longer pass explicit headers

Fixes #11510
