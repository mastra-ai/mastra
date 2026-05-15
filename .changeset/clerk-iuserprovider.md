---
'@mastra/auth-clerk': minor
---

Added IUserProvider, ISSOProvider, and ISessionProvider for Studio login support.

- `getCurrentUser` extracts and verifies JWT tokens from Authorization headers or session cookies
- `getUser` fetches full user details from the Clerk Users API
- SSO login via Clerk as OAuth 2.0/OIDC Identity Provider (requires OAuth Application in Clerk Dashboard)
- Encrypted session cookies (PBKDF2 + AES-GCM) for persistent login

```typescript
import { MastraAuthClerk } from '@mastra/auth-clerk';

// Basic usage (IUserProvider only — validates JWTs)
const auth = new MastraAuthClerk({
  jwksUri: process.env.CLERK_JWKS_URI,
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});

// With SSO for Studio login
const authWithSSO = new MastraAuthClerk({
  jwksUri: process.env.CLERK_JWKS_URI,
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  oauthClientId: process.env.CLERK_OAUTH_CLIENT_ID,
  oauthClientSecret: process.env.CLERK_OAUTH_CLIENT_SECRET,
  session: { cookiePassword: process.env.CLERK_COOKIE_PASSWORD },
});
```
