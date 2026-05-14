---
'@mastra/core': minor
'@mastra/auth-workos': minor
'@mastra/server': minor
---

Added FGA route policy coverage controls, built-in resource route metadata resolution, and resolver hooks.

For example:

```ts
import { MastraFGAWorkos } from '@mastra/auth-workos';
import type { FGARouteConfig, FGARouteResolver, IFGAProvider } from '@mastra/core/auth/ee';
import { createRoute } from '@mastra/server/server-adapter';

const routeFGA = {
  'GET /billing/:accountId': {
    resourceType: 'account',
    resourceIdParam: 'accountId',
    permission: 'billing:read',
  },
} satisfies Record<string, FGARouteConfig>;

const resolveRouteFGA: FGARouteResolver = ({ route }) => routeFGA[`${route.method} ${route.path}`];

const fga: IFGAProvider = new MastraFGAWorkos({
  apiKey: process.env.WORKOS_API_KEY!,
  clientId: process.env.WORKOS_CLIENT_ID!,
  requireForProtectedRoutes: true,
  auditProtectedRoutes: 'warn',
  resolveRouteFGA,
  validatePermissions: async permissions => {
    /* validate mappings */
  },
});

export const getProjectRoute = createRoute({
  method: 'GET',
  path: '/projects/:projectId',
  responseType: 'json',
  requiresAuth: true,
  fga: {
    resourceType: 'project',
    resourceIdParam: 'projectId',
    permission: 'projects:read',
  },
  handler: async () => {
    return { project: null };
  },
});
```
