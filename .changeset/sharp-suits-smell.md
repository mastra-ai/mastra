---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/playground-ui': minor
'@mastra/auth-workos': minor
'@mastra/auth-better-auth': minor
'@mastra/auth-cloud': minor
---

Add Enterprise Edition authentication with SSO, RBAC, session management, and audit logging

Added comprehensive enterprise authentication capabilities to Mastra, including Single Sign-On (SSO), role-based access control (RBAC), session management, and audit logging. This introduces a pluggable auth provider system with three official implementations.

**Core EE Module**

Added a new Enterprise Edition module in @mastra/core with:

- Composable authentication interfaces (IUserProvider, ISessionProvider, ISSOProvider, ICredentialsProvider)
- Role-based access control (IRBACProvider) with permission hierarchies and wildcard support
- Resource-level access control (IACLProvider) for granular permissions
- Audit logging (IAuditLogger) for compliance and security event tracking
- License validation system with MASTRA_EE_LICENSE environment variable support
- Default implementations: MemorySessionProvider, CookieSessionProvider, StaticRBACProvider, ConsoleAuditLogger
- withEE() composition helper to add EE capabilities to any auth provider

**Auth Providers**

Three authentication provider packages are now available:

1. **@mastra/auth-workos** - Enterprise SSO via WorkOS AuthKit
   - SSO with multiple identity providers (Google, Microsoft, Okta, etc.)
   - Directory Sync (SCIM) for user provisioning
   - Audit log export to WorkOS
   - Organization-based RBAC

2. **@mastra/auth-better-auth** - Self-hosted credentials authentication
   - Email/password authentication with secure password hashing
   - Database-backed user management (PostgreSQL, MySQL, SQLite)
   - Optional password reset flows
   - Configurable signup enablement

3. **@mastra/auth-cloud** - Zero-config Mastra Cloud authentication
   - Managed SSO and user management via Mastra Cloud
   - Built-in RBAC with Mastra Cloud permissions API
   - No license key required (isMastraCloudAuth flag)

**Server API**

Added authentication and audit API endpoints:

- POST /api/auth/login - Credentials login
- POST /api/auth/signup - User registration
- GET /api/auth/sso - Initiate SSO flow
- GET /api/auth/callback - Handle SSO callback
- POST /api/auth/logout - Session termination
- GET /api/auth/me - Current user info
- GET /api/auth/capabilities - Public and authenticated capabilities
- GET /api/audit - Query audit events with filtering and pagination
- GET /api/audit/export - Export audit logs as JSON or CSV

**Playground UI**

Added authentication UI components and pages:

- Login page with SSO and credentials support
- Signup page with form validation
- OAuth callback handler
- AuthRequired guard component for route protection
- AuthStatus component with user menu
- Permission-based UI visibility
- Audit log viewer with filtering and export

**Usage Example**

```typescript
import { Mastra } from '@mastra/core';
import { MastraAuthWorkosEE } from '@mastra/auth-workos';

const auth = new MastraAuthWorkosEE({
  clientId: process.env.WORKOS_CLIENT_ID!,
  apiKey: process.env.WORKOS_API_KEY!,
  redirectUri: 'http://localhost:3000/oauth/callback',
  cookiePassword: process.env.COOKIE_PASSWORD!,
  roleMapping: {
    admin: ['*'], // Full access
    member: ['agents:read', 'agents:execute', 'workflows:read'],
    viewer: ['agents:read', 'workflows:read'],
  },
});

const mastra = new Mastra({
  server: {
    auth,
  },
});
```

**Permission System**

Permissions use dot-notation with wildcard support:

- 'studio:\*' - All studio permissions
- 'agents:read', 'agents:write', 'agents:execute' - Agent permissions
- 'workflows:read', 'workflows:execute' - Workflow permissions
- 'audit:read' - Audit log access
- '\*' - Full access (owner role)

**Default Roles**

Four default roles are provided:

- owner: Full access ('\*')
- admin: Studio, agents, workflows, tools, logs, settings
- member: Read and execute access to agents and workflows
- viewer: Read-only access

**Audit Events**

Audit logging tracks security events with:

- Actor information (user, system, or API key)
- Action performed
- Resource affected
- Outcome (success, failure, denied)
- Timing and duration
- Custom metadata
- IP address and user agent

**Why This Matters**

Enterprise applications require secure authentication, fine-grained access control, and compliance-ready audit trails. This release provides a production-ready auth system that scales from self-hosted deployments to enterprise SSO integrations, with full audit logging for SOC 2 and ISO 27001 compliance requirements.
