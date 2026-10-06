# @mastra/auth-oidc

`@mastra/auth-oidc` authenticates Mastra users against any OpenID Connect provider. Point it at an issuer URL and endpoints are read from the provider's discovery document, so it works with Keycloak, Authentik, Zitadel, Microsoft Entra ID, Ping Identity, Dex, and other OIDC-compliant servers without a provider-specific package.

The protocol work is handled by [`openid-client`](https://github.com/panva/openid-client), the OpenID Foundation certified relying party library: discovery, PKCE, the authorization code grant, ID token validation, and provider-initiated logout.

## Installation

```bash
npm install @mastra/auth-oidc
```

## Usage

Set `OIDC_ISSUER` and `OIDC_CLIENT_ID` before starting Mastra. Add `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`, and `OIDC_COOKIE_PASSWORD` to enable the SSO login flow for Studio.

```typescript
import { MastraAuthOidc } from '@mastra/auth-oidc';
import { Mastra } from '@mastra/core/mastra';

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

Without a client secret the provider only verifies Bearer tokens against the issuer's JWKS.

## Documentation

- [OpenID Connect authentication guide](https://mastra.ai/integrations/auth/oidc)
- [OpenID Connect provider reference](https://mastra.ai/reference/auth/oidc)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/oidc/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
