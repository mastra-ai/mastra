---
'@mastra/server': minor
---

Added dual auth system for separate Studio and API authentication.

When configured, Studio and server (API) can use different auth providers:

- `server.auth` handles API authentication (external customers)
- `studio.auth` handles Studio authentication (internal team)

**Dual auth is opt-in:** If `studio.auth` is not configured, Studio requests fall back to `server.auth` for backward compatibility. To enable strict separation, configure both.

**Example**

```typescript
const mastra = new Mastra({
  server: {
    auth: new MastraAuthWorkos({ ... }), // External customers
  },
  studio: {
    auth: new MastraAuthOkta({ ... }), // Internal team
    rbac: new StaticRBACProvider({
      roles: DEFAULT_ROLES,
      getUserRoles: (user) => [user.role],
    }),
  },
});
```

This pattern matches real-world SaaS architecture (e.g., Stripe, Supabase) with separate dashboard and API authentication.
