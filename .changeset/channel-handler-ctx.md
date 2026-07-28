---
'@mastra/core': minor
---

Channel handlers now receive a 4th argument: a `ChannelHandlerContext` carrying the resolved `mastra` instance. Custom handlers can read `ctx.mastra`.
