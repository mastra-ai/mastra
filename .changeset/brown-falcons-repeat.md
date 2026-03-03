---
'@mastra/core': minor
---

Added authentication interfaces and Enterprise Edition RBAC support.

**New `@mastra/core/auth` export** with pluggable interfaces for building auth providers:

- `IUserProvider` — user lookup and management
- `ISessionProvider` — session creation, validation, and cookie handling
- `ISSOProvider` — SSO login and callback flows
- `ICredentialsProvider` — username/password authentication

**Default implementations** included out of the box:

- Cookie-based session provider with configurable TTL and secure defaults
- In-memory session provider for development and testing

**Enterprise Edition (`@mastra/core/auth/ee`)** adds RBAC, ACL, and license validation:

```ts
import { buildCapabilities } from '@mastra/core/auth/ee';

const capabilities = buildCapabilities({
  rbac: myRBACProvider,
  acl: myACLProvider,
});
```

Built-in role definitions (owner, admin, editor, viewer) and a static RBAC provider are included for quick setup. Enterprise features require a valid license key via the `MASTRA_EE_LICENSE` environment variable.
