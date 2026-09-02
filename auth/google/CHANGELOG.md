# @mastra/auth-google

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
