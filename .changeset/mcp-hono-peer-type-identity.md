---
'@mastra/mcp': patch
---

Fix type identity for Hono types crossing the `@mastra/mcp` public API. `hono` is now a peer dependency and its declarations are no longer vendored into `dist/_types`, so `MCPServer.connectHonoSSE({ stream })` and `getSseHonoTransport()` now use the consumer's own hono types. Passing a hono `SSEStreamingApi` from the consumer's app no longer fails typechecking with TS2322 nominal-mismatch errors.
