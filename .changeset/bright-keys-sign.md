---
'@mastra/auth-google': minor
---

Added native Google Workspace authentication and group-based RBAC.

- `MastraAuthGoogle` supports Google OpenID Connect sign-in, encrypted Studio session cookies, Bearer ID token verification, and Workspace hosted-domain checks using Google's verified `hd` claim.
- `MastraRBACGoogle` maps Google Workspace groups to Mastra permissions through the Admin SDK Directory API, with service-account domain-wide delegation support.

**Usage:**

```typescript
import { MastraAuthGoogle, MastraRBACGoogle } from '@mastra/auth-google';

const mastra = new Mastra({
  server: {
    auth: new MastraAuthGoogle({
      allowedDomains: ['example.com'],
    }),
    rbac: new MastraRBACGoogle({
      serviceAccount: {
        clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
        privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!,
        subject: process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL!,
      },
      roleMapping: {
        'admins@example.com': ['*'],
        'engineering@example.com': ['agents:*', 'workflows:*'],
        _default: [],
      },
    }),
  },
});
```
