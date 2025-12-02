---
'@mastra/express': patch
'@mastra/hono': patch
'@mastra/deployer': patch
'@mastra/server': patch
'@mastra/core': patch
---

Allow direct access to server app for in-memory route calls

Previously, calling Mastra routes from background jobs (like Inngest functions) required making HTTP requests to `localhost`. Now you can access the underlying server app directly and call routes in-memory using `app.fetch()`.

```ts
// Before: HTTP request to localhost
const response = await fetch(`http://localhost:5000/api/tools`);

// After: Direct in-memory call via app.fetch()
const app = mastra.getServerApp<Hono>();
const response = await app.fetch(new Request('http://internal/api/tools'));
```

- Added `mastra.getServerApp<T>()` to access the underlying Hono/Express app
- Added `mastra.getMastraServer()` and `mastra.setMastraServer()` for adapter access
- Added `MastraServerBase` class in `@mastra/core/server` for adapter implementations
- Server adapters now auto-register with Mastra in their constructor
