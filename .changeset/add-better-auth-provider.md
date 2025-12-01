---
'@mastra/auth-better-auth': minor
---

Add Better Auth authentication provider

Adds a new authentication provider for Better Auth, a self-hosted, open-source authentication framework.

```typescript
import { betterAuth } from 'better-auth';
import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';
import { Mastra } from '@mastra/core';

// Create your Better Auth instance
const auth = betterAuth({
  database: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL!,
  },
  emailAndPassword: {
    enabled: true,
  },
});

// Create the Mastra auth provider
const mastraAuth = new MastraAuthBetterAuth({
  auth,
});

// Use with Mastra
const mastra = new Mastra({
  server: {
    auth: mastraAuth,
  },
});
```

