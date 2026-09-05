---
'@mastra/server': patch
---

Fixed the memory API returning other users' threads when server auth is configured without `mapUserToResourceId`. An authenticated request that resolved to no resource ID previously listed, read and mutated every resource's threads; it is now rejected with a 403.

**Before** — auth is configured, but nothing maps the user to a resource, so `GET /api/memory/threads` returned every resource's threads:

```typescript
export const mastra = new Mastra({
  server: {
    auth: {
      authenticateToken: async token => verifyToken(token),
    },
  },
});
```

**After** — derive the resource ID from the authenticated user, and each caller sees only their own threads:

```typescript
export const mastra = new Mastra({
  server: {
    auth: {
      authenticateToken: async token => verifyToken(token),
      mapUserToResourceId: user => user.id,
    },
  },
});
```

Callers can instead pass an explicit `resourceId` on the routes that accept one, such as `GET /api/memory/threads?resourceId=user-123`.

Servers with no auth provider (local development and Studio) are unaffected, an FGA provider still authorizes each thread individually, and callers holding a `memory:*` or `memory:admin` permission can still enumerate across resources.

Resolves https://github.com/mastra-ai/mastra/issues/18911
