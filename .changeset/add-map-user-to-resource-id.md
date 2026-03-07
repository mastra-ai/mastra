---
'@mastra/core': minor
'@mastra/server': minor
---

feat(server): Add `mapUserToResourceId` callback to auth config for automatic resource ID scoping

Auth configs now accept a `mapUserToResourceId` callback that maps the authenticated user to a resource ID after successful authentication. This enables per-user memory and thread isolation without requiring custom middleware or adapter subclassing.

```typescript
const mastra = new Mastra({
  server: {
    auth: {
      authenticateToken: async (token) => verifyToken(token),
      mapUserToResourceId: (user) => user.id,
    },
  },
});
```

The callback is called in `coreAuthMiddleware` after the user is authenticated and set on the request context. The returned value is set as `MASTRA_RESOURCE_ID_KEY`, which takes precedence over client-provided values for security. Works across all server adapters (Hono, Express, Next.js, etc.).
