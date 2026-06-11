---
'@mastra/auth-clerk': minor
---

Added full Studio authentication support for Clerk users.

**What's new:**
- **Studio SSO login** — your internal team can now sign in to Mastra Studio using their Clerk accounts via OAuth 2.0/OIDC
- **JWT validation** — API requests with Clerk-issued JWTs are automatically validated
- **Session persistence** — Studio sessions are maintained with encrypted cookies (no need to log in repeatedly)

**Setup:**
1. Create an OAuth Application in your Clerk Dashboard
2. Configure the auth provider with your Clerk credentials

```typescript
import { MastraAuthClerk } from '@mastra/auth-clerk';

const auth = new MastraAuthClerk({
  jwksUri: process.env.CLERK_JWKS_URI,
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  // For Studio SSO login:
  oauthClientId: process.env.CLERK_OAUTH_CLIENT_ID,
  oauthClientSecret: process.env.CLERK_OAUTH_CLIENT_SECRET,
  session: { cookiePassword: process.env.CLERK_COOKIE_PASSWORD },
});
```
