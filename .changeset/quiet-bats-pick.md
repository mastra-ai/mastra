---
'@mastra/core': minor
'@mastra/server': minor
---

Added FGA route policy coverage controls, built-in resource route metadata resolution, and resolver hooks.

For example:

```ts
import type { IFGAProvider } from '@mastra/core/auth/ee';
import { MastraFGAWorkos } from '@mastra/auth-workos';

const fga: IFGAProvider = Object.assign(
  new MastraFGAWorkos({
    apiKey: process.env.WORKOS_API_KEY!,
    clientId: process.env.WORKOS_CLIENT_ID!,
  }),
  {
    requireForProtectedRoutes: true,
    auditProtectedRoutes: 'warn' as const,
    resolveRouteFGA: ({ route, params, requestContext }) => {
      /* return FGA metadata */
      return route.path.startsWith('/agents/:agentId')
        ? {
            resourceType: 'agent',
            resourceId: String(params.agentId),
            permission: 'agents:read',
          }
        : null;
    },
    validatePermissions: async permissions => {
      /* validate mappings */
    },
  },
);
```
