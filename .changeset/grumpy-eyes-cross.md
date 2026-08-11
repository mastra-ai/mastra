---
'@mastra/server': minor
---

Added `MastraServer.getFrameworkPublicMatcher()`, which returns a `(path, method) => boolean` matcher built from route metadata (built-in `SERVER_ROUTES` entries with `requiresAuth === false`, plus user-registered custom routes with `requiresAuth: false`).

Adapters can use it to short-circuit user middleware for routes the framework has declared public, without duplicating any allowlist.

```ts
const isFrameworkPublic = mastraServer.getFrameworkPublicMatcher();

app.use('*', async (c, next) => {
  if (isFrameworkPublic(c.req.path, c.req.method)) {
    return next();
  }
  return userMiddleware(c, next);
});
```
