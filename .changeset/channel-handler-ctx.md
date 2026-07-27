---
'@mastra/core': minor
---

Channel handlers now receive a 4th argument: a `ChannelHandlerContext` carrying the resolved `mastra` instance. Custom handlers can read `ctx.mastra` directly instead of being injected with an external accessor. The argument is optional, so handlers written against the existing `(thread, message, defaultHandler)` signature keep working unchanged.
