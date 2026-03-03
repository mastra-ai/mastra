---
'@mastra/auth-workos': minor
---

Added full auth provider to `@mastra/auth-workos` with SSO, RBAC, SCIM directory sync, and admin portal support.

```ts
import { MastraAuthWorkos, MastraRBACWorkos } from '@mastra/auth-workos';

const mastra = new Mastra({
  server: {
    auth: new MastraAuthWorkos({
      apiKey: process.env.WORKOS_API_KEY,
      clientId: process.env.WORKOS_CLIENT_ID,
    }),
    rbac: new MastraRBACWorkos({
      apiKey: process.env.WORKOS_API_KEY,
      clientId: process.env.WORKOS_CLIENT_ID,
      roleMapping: {
        admin: ['*'],
        member: ['agents:read', 'workflows:*'],
      },
    }),
  },
});
```

- **SSO** via WorkOS AuthKit (SAML, OIDC)
- **RBAC** with wildcard permission mapping from WorkOS organization roles
- **Directory Sync** webhook handler for SCIM-based user provisioning
- **Admin Portal** helper for customer self-service SSO configuration
