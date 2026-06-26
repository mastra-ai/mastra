---
'@mastra/auth-google': minor
---

Added native Google Workspace authentication and group-based RBAC.

- `MastraAuthGoogle` lets developers authenticate users with Google accounts and restrict access to trusted Google Workspace domains.
- `MastraRBACGoogle` lets developers map Google Workspace groups to Mastra permissions for role-based access.

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
