---
'@mastra/express': patch
'@mastra/hono': patch
'@mastra/deployer': patch
'@mastra/server': patch
'@mastra/core': patch
---

Add `mastra.getServerApp()` API for direct server app access

- Added `setMastraServer()` and `getMastraServer()` methods to Mastra class
- Added `getServerApp<T>()` convenience method that returns the underlying app (Hono, Express, etc.)
- Added `MastraServerBase` class in `@mastra/core/server` for adapter implementations to extend
