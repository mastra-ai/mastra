---
'@mastra/auth-better-auth': patch
---

Added a deferred instance mode and organization management to MastraAuthBetterAuth so it can be passed directly to a server host without a wrapper adapter. The provider can now be constructed with just a secret and will build its Better Auth instance (including running migrations) against the host database during init. It also bootstraps a personal organization for new users (ensureOrganization), checks organization admin roles (isOrganizationAdmin), and exposes the Better Auth HTTP handler (handleAuthRequest) so hosts can mount it under /auth/api/*.

**Before**

```ts
import { betterAuth } from 'better-auth';
import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';

const auth = new MastraAuthBetterAuth({ auth: betterAuth({ /* ... */ }) });
```

**After** (bring-your-own instance still works)

```ts
import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';

const auth = new MastraAuthBetterAuth({ secret: process.env.BETTER_AUTH_SECRET! });
// host calls auth.init({ database, publicUrl, allowedOrigins }) during startup
```
