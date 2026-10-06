---
'@mastra/auth-oidc': minor
---

Added `@mastra/auth-oidc`, a generic OpenID Connect auth provider for identity providers that have no dedicated Mastra package, such as Keycloak, Authentik, Zitadel, Microsoft Entra ID, Ping Identity, and Dex.

Point it at an issuer URL and the authorization, token, JWKS, and logout endpoints are read from that issuer's OpenID Connect discovery document. The protocol is handled by `openid-client`, the OpenID Foundation certified relying party library.

```typescript
import { Mastra } from '@mastra/core';
import { MastraAuthOidc } from '@mastra/auth-oidc';

export const mastra = new Mastra({
  server: {
    auth: new MastraAuthOidc({
      issuer: 'https://id.example.com/realms/acme',
      clientId: 'mastra',
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      redirectUri: 'http://localhost:4111/api/auth/sso/callback',
      label: 'Keycloak',
    }),
  },
});
```

**What it supports**

- Studio SSO login with PKCE, encrypted cookie sessions, and provider-initiated logout.
- Bearer token verification against the issuer's JWKS, with a configurable `audience`.
- `mapClaims` for providers that use non-standard claim names, and `serverMetadata` for providers that publish no discovery document.

Omit the client secret to verify Bearer tokens only, without the login flow.
