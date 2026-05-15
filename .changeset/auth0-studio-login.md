---
'@mastra/auth-auth0': minor
---

Added IUserProvider, ISSOProvider, and ISessionProvider for Studio login support.

- `getCurrentUser` extracts and verifies JWT tokens from Authorization headers or session cookies
- `getUser` returns minimal user object from available data
- SSO login via Auth0 OAuth 2.0/OIDC (standard Authorization Code flow)
- Encrypted session cookies (PBKDF2 + AES-GCM) for persistent login
- Auth0 RP-Initiated Logout support via `/v2/logout`

```typescript
import { MastraAuthAuth0 } from '@mastra/auth-auth0';

// Basic usage (IUserProvider only — validates JWTs)
const auth = new MastraAuthAuth0({
  domain: 'your-tenant.auth0.com',
  audience: 'https://your-api',
});

// With SSO for Studio login
const authWithSSO = new MastraAuthAuth0({
  domain: 'your-tenant.auth0.com',
  audience: 'https://your-api',
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  session: { cookiePassword: process.env.AUTH0_COOKIE_PASSWORD },
});
```
