---
'@mastra/auth-cloud': minor
---

Added `@mastra/auth-cloud` — a new auth provider for Mastra Cloud with PKCE OAuth flow, session management, and role-based access control.

```ts
import { MastraCloudAuthProvider, MastraRBACCloud } from '@mastra/auth-cloud';

const mastra = new Mastra({
  server: {
    auth: new MastraCloudAuthProvider({
      appId: process.env.MASTRA_APP_ID!,
      apiKey: process.env.MASTRA_API_KEY!,
    }),
    rbac: new MastraRBACCloud({
      appId: process.env.MASTRA_APP_ID!,
      apiKey: process.env.MASTRA_API_KEY!,
    }),
  },
});
```

Handles the full OAuth lifecycle including login URL generation, PKCE challenge/verification, callback handling, and session cookie management.
