# @mastra/auth-google

## 0.1.7

### Patch Changes

- dependencies updates: ([#28417](https://github.com/mastra-ai/mastra/pull/28417))
  - Updated dependency [`jose@^6.2.12` ↗︎](https://www.npmjs.com/package/jose/v/6.2.12) (from `^6.2.11`, in `dependencies`)
  - Updated dependency [`lru-cache@^11.5.3` ↗︎](https://www.npmjs.com/package/lru-cache/v/11.5.3) (from `^11.2.7`, in `dependencies`)
  - Updated dependency [`@types/node@22.19.15` ↗︎](https://www.npmjs.com/package/@types/node/v/22.19.15) (from `22.20.5`, in `devDependencies`)

## 0.1.7-alpha.0

### Patch Changes

- dependencies updates: ([#28417](https://github.com/mastra-ai/mastra/pull/28417))
  - Updated dependency [`jose@^6.2.12` ↗︎](https://www.npmjs.com/package/jose/v/6.2.12) (from `^6.2.11`, in `dependencies`)
  - Updated dependency [`lru-cache@^11.5.3` ↗︎](https://www.npmjs.com/package/lru-cache/v/11.5.3) (from `^11.2.7`, in `dependencies`)
  - Updated dependency [`@types/node@22.19.15` ↗︎](https://www.npmjs.com/package/@types/node/v/22.19.15) (from `22.20.5`, in `devDependencies`)

## 0.1.6

### Patch Changes

- Bump for npm ([#27221](https://github.com/mastra-ai/mastra/pull/27221))

## 0.1.6-alpha.0

### Patch Changes

- Bump for npm ([#27221](https://github.com/mastra-ai/mastra/pull/27221))

## 0.1.5

### Patch Changes

- Fixed Google SSO users being signed out after about an hour. Sessions now last for the configured `session.cookieMaxAge` (24 hours by default) instead of expiring with the short-lived Google ID token. ([#25043](https://github.com/mastra-ai/mastra/pull/25043))

## 0.1.4

### Patch Changes

- Improved Google authentication portability by signing service account tokens with Web Crypto. ([#24583](https://github.com/mastra-ai/mastra/pull/24583))

## 0.1.4-alpha.0

### Patch Changes

- Improved Google authentication portability by signing service account tokens with Web Crypto. ([#24583](https://github.com/mastra-ai/mastra/pull/24583))

## 0.1.3

### Patch Changes

- Fixed a jose security advisory by updating jose to 6.2.11. Auth token verification APIs are unchanged. ([#24027](https://github.com/mastra-ai/mastra/pull/24027))

## 0.1.3-alpha.0

### Patch Changes

- Fixed a jose security advisory by updating jose to 6.2.11. Auth token verification APIs are unchanged. ([#24027](https://github.com/mastra-ai/mastra/pull/24027))

## 0.1.2

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

## 0.1.2-alpha.1

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

## 0.1.2-alpha.0

### Patch Changes

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

## 0.1.1

### Patch Changes

- Fixed reading request headers from Express-style plain header objects so cookie-based auth providers no longer throw and fail with a misleading 401. ([#21261](https://github.com/mastra-ai/mastra/pull/21261))

  Related to https://github.com/mastra-ai/mastra/issues/21253

## 0.1.1-alpha.0

### Patch Changes

- Fixed reading request headers from Express-style plain header objects so cookie-based auth providers no longer throw and fail with a misleading 401. ([#21261](https://github.com/mastra-ai/mastra/pull/21261))

  Related to https://github.com/mastra-ai/mastra/issues/21253

## 0.1.0

### Minor Changes

- Added native Google Workspace authentication and group-based RBAC. ([#18160](https://github.com/mastra-ai/mastra/pull/18160))
  - `MastraAuthGoogle` lets developers authenticate users with Google accounts and restrict access to trusted Google Workspace domains.
  - `MastraRBACGoogle` lets developers map Google Workspace groups to Mastra permissions for role-based access.

  **Usage:**

  ```typescript
  import { MastraAuthGoogle, MastraRBACGoogle } from '@mastra/auth-google';

  const mastra = new Mastra({
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

## 0.1.0-alpha.0

### Minor Changes

- Added native Google Workspace authentication and group-based RBAC. ([#18160](https://github.com/mastra-ai/mastra/pull/18160))
  - `MastraAuthGoogle` lets developers authenticate users with Google accounts and restrict access to trusted Google Workspace domains.
  - `MastraRBACGoogle` lets developers map Google Workspace groups to Mastra permissions for role-based access.

  **Usage:**

  ```typescript
  import { MastraAuthGoogle, MastraRBACGoogle } from '@mastra/auth-google';

  const mastra = new Mastra({
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

## 0.0.1

- Initial Google Workspace authentication and RBAC package.
