# @mastra/auth-google

Google Workspace authentication and RBAC integration for Mastra.

## Features

- Google OpenID Connect authentication
- Studio SSO with encrypted session cookies
- Workspace hosted-domain allowlisting through the verified `hd` claim
- Google Groups based RBAC through the Workspace Directory API
- Cross-provider RBAC support for Auth0, Clerk, Simple Auth, and custom providers

## Installation

```bash
npm install @mastra/auth-google
```

## Google Workspace auth

```typescript
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthGoogle } from '@mastra/auth-google';

export const mastra = new Mastra({
  server: {
    auth: new MastraAuthGoogle({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      allowedDomains: ['example.com'],
    }),
  },
});
```

## Google Groups RBAC

```typescript
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthGoogle, MastraRBACGoogle } from '@mastra/auth-google';

export const mastra = new Mastra({
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

## Environment variables

| Variable                             | Description                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`                   | Google OAuth client ID                                                              |
| `GOOGLE_CLIENT_SECRET`               | Google OAuth client secret for SSO                                                  |
| `GOOGLE_REDIRECT_URI`                | OAuth redirect URI for the SSO callback                                             |
| `GOOGLE_COOKIE_PASSWORD`             | Session encryption key, at least 32 characters                                      |
| `GOOGLE_ALLOWED_DOMAINS`             | Comma-separated Google Workspace domains to allow                                   |
| `GOOGLE_HOSTED_DOMAIN`               | Hosted-domain login hint passed to Google                                           |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`       | Service account email for Directory API access                                      |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | PEM private key for the service account. Use escaped `\n` newlines in `.env` values |
| `GOOGLE_WORKSPACE_ADMIN_EMAIL`       | Workspace admin email to impersonate with domain-wide delegation                    |

`MastraAuthGoogle` reads the Google auth variables directly. The service-account variables above are examples for wiring `MastraRBACGoogle`; pass them through the `serviceAccount` option as shown.

## Exports

- `MastraAuthGoogle`
- `MastraRBACGoogle`
- `mapGoogleClaimsToUser`
- `GoogleSessionOptions`
- `GoogleUser`
- `GoogleWorkspaceGroup`
- `GoogleWorkspaceServiceAccount`
- `MastraAuthGoogleOptions`
- `MastraRBACGoogleOptions`
- `PermissionCacheOptions`
