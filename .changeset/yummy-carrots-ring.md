---
'@mastra/koa': patch
---

Fixed SSE streaming to use proper `text/event-stream` Content-Type instead of `text/plain` (fixes [#12620](https://github.com/mastra-ai/mastra/issues/12620)). This prevents proxies, CDNs, and HTTP clients (like Postman) from buffering the entire response before delivering it. SSE streams now also include `Cache-Control: no-cache`, `Connection: keep-alive`, and `X-Accel-Buffering: no` headers for reliable progressive chunk delivery.
