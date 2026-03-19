---
'@mastra/server': patch
---

fix: remove explicit Transfer-Encoding header to prevent duplicate headers in Bun runtime

Removes explicit `Transfer-Encoding: chunked` header from `toTextStreamResponse()` and `toDataStreamResponse()` calls in agent streaming handlers. When deploying with Bun, the runtime automatically adds this header for `ReadableStream` responses. Setting it explicitly caused duplicate headers, which broke HTTP protocol compliance and resulted in 502 errors.

Node.js runtimes will continue to automatically add the `Transfer-Encoding` header for chunked responses, so this change has no impact on Node.js deployments.

Fixes #11510
