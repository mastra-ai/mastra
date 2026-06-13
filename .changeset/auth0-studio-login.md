---
'@mastra/auth-auth0': minor
'@mastra/core': patch
'@mastra/server': patch
---

Added full Studio authentication support for Auth0 users.

**What's new:**
- **Studio SSO login** — your internal team can now sign in to Mastra Studio using their Auth0 accounts via OAuth 2.0/OIDC
- **JWT validation** — API requests with Auth0-issued JWTs are automatically validated
- **Session persistence** — Studio sessions are maintained with encrypted cookies (no need to log in repeatedly)
- **Secure logout** — proper RP-Initiated Logout support via Auth0's `/v2/logout` endpoint

**Setup:**
1. Create a Regular Web Application in your Auth0 Dashboard
2. Configure the auth provider with your Auth0 credentials

```typescript
import { MastraAuthAuth0 } from '@mastra/auth-auth0';

const auth = new MastraAuthAuth0({
  domain: 'your-tenant.auth0.com',
  audience: 'https://your-api',
  // For Studio SSO login:
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  session: { cookiePassword: process.env.AUTH0_COOKIE_PASSWORD },
});
```

**Note:** This release includes updates to `@mastra/core` (ISSOProvider interface now supports async getLoginUrl) and `@mastra/server` (handles async login URLs). All three packages should be updated together.
