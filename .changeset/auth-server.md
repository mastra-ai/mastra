---
'@mastra/server': minor
---

Added auth handlers and route-level permission enforcement to the server.

**Auth API routes** for login, signup, logout, session validation, and SSO flows — all wired automatically when an auth provider is configured on the Mastra instance.

**Route-level permission enforcement** via `requiresPermission` in route configs. Permissions are derived automatically from the route path and HTTP method using a convention-based system (`{resource}:{action}`), so most routes are protected without any manual configuration:

```ts
// Automatic: GET /api/agents → requires "agents:read"
// Automatic: POST /api/workflows/:id/execute → requires "workflows:execute"

// Or specify explicitly:
const route = {
  path: '/api/custom',
  method: 'POST',
  requiresPermission: 'custom:write',
  handler: myHandler,
};
```
