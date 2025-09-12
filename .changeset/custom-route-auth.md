---
"@mastra/core": patch
"@mastra/deployer": patch
---

feat: add requiresAuth option for custom API routes

Added a new `requiresAuth` option to the `ApiRoute` type that allows users to explicitly control authentication requirements for custom endpoints.

- By default, all custom routes require authentication (`requiresAuth: true`)
- Set `requiresAuth: false` to make a route publicly accessible without authentication
- The auth middleware now checks this configuration before applying authentication

Example usage:
```typescript
const customRoutes: ApiRoute[] = [
  {
    path: '/api/public-endpoint',
    method: 'GET',
    requiresAuth: false, // No authentication required
    handler: async (c) => c.json({ message: 'Public access' }),
  },
  {
    path: '/api/protected-endpoint', 
    method: 'GET',
    requiresAuth: true, // Authentication required (default)
    handler: async (c) => c.json({ message: 'Protected access' }),
  },
];
```

This addresses issue #7674 where custom endpoints were not being protected by the authentication system.