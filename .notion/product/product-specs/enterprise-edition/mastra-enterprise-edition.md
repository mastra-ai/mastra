# Mastra Enterprise Edition (EE)

Phased implementation of enterprise features for Mastra, starting with a license-gated feature flag system and progressively adding auth, RBAC, and audit capabilities.

---

## Phase 1: EE Gate Foundation

**Status:** Planned
**Priority:** Critical
**Branch:** `feat/ee-gate`

Establish the enterprise license validation and feature gating infrastructure. This phase creates the foundation that all other EE features will build upon.

### Deliverables

#### P1-License: License Validation

Core license validation logic that checks MASTRA_EE_LICENSE environment variable.

**Files:**
- `packages/core/src/ee/license.ts`

**Exports:**
- `validateLicense(licenseKey?: string): LicenseInfo`
- `isEELicenseValid(): boolean`
- `isFeatureEnabled(feature: string): boolean`
- `LicenseInfo type`

#### P1-Feature-Flags: Feature Flag Types

Type definitions for EE feature flags that can be checked at runtime.

**Files:**
- `packages/core/src/ee/features.ts`

**Exports:**
- `EEFeature enum (auth, rbac, acl, audit, sso)`
- `EEFeatureConfig type`

#### P1-Exports: Package Exports

Export the EE module from @mastra/core.

**Files:**
- `packages/core/src/ee/index.ts`
- `packages/core/src/index.ts`

### Acceptance Criteria

- [ ] Setting MASTRA_EE_LICENSE with a valid key (32+ chars) enables EE features
- [ ] isEELicenseValid() returns true/false based on license presence
- [ ] isFeatureEnabled('auth') can gate specific features
- [ ] License validation is cached for 1 minute to avoid repeated checks
- [ ] Console warning is shown when license is invalid but env var is set
- [ ] Exports available from '@mastra/core/ee'

---

## Phase 2: Auth Interfaces & Capabilities

**Status:** Planned
**Priority:** High
**Branch:** `feat/ee-auth-interfaces`
**Depends On:** Phase 1

Define the interfaces for authentication providers without implementing them. This establishes the contract that auth providers must fulfill.

### Deliverables

#### P2-User-Interface: User Provider Interface

Interface for user awareness - getting current user from request.

**Files:**
- `packages/core/src/ee/interfaces/user.ts`

**Exports:**
- `EEUser type`
- `IUserProvider interface`

#### P2-Session-Interface: Session Provider Interface

Interface for session management - create, validate, destroy sessions.

**Files:**
- `packages/core/src/ee/interfaces/session.ts`

**Exports:**
- `Session type`
- `ISessionProvider interface`

#### P2-SSO-Interface: SSO Provider Interface

Interface for single sign-on - OAuth/OIDC login flows.

**Files:**
- `packages/core/src/ee/interfaces/sso.ts`

**Exports:**
- `SSOLoginConfig type`
- `SSOCallbackResult type`
- `ISSOProvider interface`

#### P2-Credentials-Interface: Credentials Provider Interface

Interface for username/password authentication.

**Files:**
- `packages/core/src/ee/interfaces/credentials.ts`

**Exports:**
- `CredentialsResult type`
- `ICredentialsProvider interface`

#### P2-Capabilities: Capabilities Detection

Build capability responses based on which interfaces an auth provider implements.

**Files:**
- `packages/core/src/ee/capabilities.ts`

**Exports:**
- `PublicAuthCapabilities type`
- `AuthenticatedCapabilities type`
- `CapabilityFlags type`
- `buildCapabilities() function`

#### P2-With-EE: withEE Wrapper

Wrapper function to compose auth providers with EE capabilities.

**Files:**
- `packages/core/src/ee/with-ee.ts`

**Exports:**
- `withEE() function`
- `WithEEOptions type`
- `EEAuthProvider type`

### Acceptance Criteria

- [ ] All interfaces are type-only (no runtime implementation required)
- [ ] Interfaces are designed for composition (providers implement what they support)
- [ ] buildCapabilities() detects which interfaces a provider implements
- [ ] withEE() allows wrapping existing auth providers with EE capabilities
- [ ] License check is enforced - unlicensed providers get no EE features

---

## Phase 3: Auth Server & UI

**Status:** Planned
**Priority:** High
**Branch:** `feat/ee-auth-server-ui`
**Depends On:** Phase 2

Implement server-side auth handlers and Studio UI for login/logout flows.

### Deliverables

#### P3-Auth-Handlers: Auth API Handlers

Server handlers for /api/auth/* endpoints.

**Files:**
- `packages/server/src/server/handlers/auth.ts`
- `packages/server/src/server/schemas/auth.ts`
- `packages/server/src/server/server-adapter/routes/auth.ts`

#### P3-Auth-Middleware: Auth Middleware

Hono middleware for authenticating requests.

**Files:**
- `server-adapters/hono/src/auth-middleware.ts`

#### P3-Auth-UI: Auth UI Components

Studio UI components for login, user menu, auth status.

**Files:**
- `packages/playground-ui/src/domains/auth/components/login-page.tsx`
- `packages/playground-ui/src/domains/auth/components/login-button.tsx`
- `packages/playground-ui/src/domains/auth/components/user-menu.tsx`
- `packages/playground-ui/src/domains/auth/components/user-avatar.tsx`
- `packages/playground-ui/src/domains/auth/components/auth-status.tsx`
- `packages/playground-ui/src/domains/auth/components/auth-required.tsx`

#### P3-Auth-Hooks: Auth React Hooks

React hooks for auth state and actions.

**Files:**
- `packages/playground-ui/src/domains/auth/hooks/use-current-user.ts`
- `packages/playground-ui/src/domains/auth/hooks/use-auth-capabilities.ts`
- `packages/playground-ui/src/domains/auth/hooks/use-auth-actions.ts`
- `packages/playground-ui/src/domains/auth/hooks/use-credentials-login.ts`
- `packages/playground-ui/src/domains/auth/hooks/use-credentials-signup.ts`

#### P3-Session-Defaults: Default Session Providers

Built-in session implementations (cookie, memory).

**Files:**
- `packages/core/src/ee/defaults/session/cookie.ts`
- `packages/core/src/ee/defaults/session/memory.ts`

### Acceptance Criteria

- [ ] GET /api/auth/capabilities returns login configuration
- [ ] SSO flow: /api/auth/sso/login redirects to provider, /api/auth/sso/callback handles return
- [ ] Credentials flow: POST /api/auth/login, POST /api/auth/signup
- [ ] POST /api/auth/logout destroys session
- [ ] Studio shows login page when auth required but not authenticated
- [ ] Studio shows user menu when authenticated
- [ ] Cookie session works out of the box

---

## Phase 4: RBAC (Role-Based Access Control)

**Status:** Planned
**Priority:** Medium
**Branch:** `feat/ee-rbac`
**Depends On:** Phase 3

Implement role and permission management for controlling access to Studio features.

### Deliverables

#### P4-RBAC-Interface: RBAC Interfaces

Interfaces for role and permission management.

**Files:**
- `packages/core/src/ee/interfaces/rbac.ts`

**Exports:**
- `RoleDefinition type`
- `IRBACProvider interface`
- `IRBACManager interface`

#### P4-ACL-Interface: ACL Interfaces

Interfaces for resource-level access control.

**Files:**
- `packages/core/src/ee/interfaces/acl.ts`

**Exports:**
- `ResourceIdentifier type`
- `ACLGrant type`
- `IACLProvider interface`
- `IACLManager interface`

#### P4-Static-RBAC: Static RBAC Provider

Simple role provider using static configuration.

**Files:**
- `packages/core/src/ee/defaults/rbac/static.ts`
- `packages/core/src/ee/defaults/roles.ts`

**Exports:**
- `StaticRBACProvider class`
- `DEFAULT_ROLES constant`

#### P4-Permission-Enforcement: Permission Enforcement

Server-side permission checks on API routes.

**Files:**
- `packages/server/src/server/handlers/agents.ts (add permission checks)`

#### P4-UI-Permissions: UI Permission Checks

Hide/disable UI elements based on user permissions.

**Files:**
- `packages/playground-ui/src/domains/auth/hooks/use-permissions.ts`

### Acceptance Criteria

- [ ] Roles can be defined with sets of permissions
- [ ] Users can be assigned roles via auth provider
- [ ] hasPermission() checks user's effective permissions
- [ ] API routes can require specific permissions
- [ ] UI hides actions user doesn't have permission for
- [ ] DEFAULT_ROLES provides sensible defaults (admin, developer, viewer)

---

## Phase 5: Audit Logging

**Status:** Planned
**Priority:** Medium
**Branch:** `feat/ee-audit`
**Depends On:** Phase 3

Implement audit logging for tracking user actions in Studio.

### Deliverables

#### P5-Audit-Interface: Audit Logger Interface

Interface for audit event logging and querying.

**Files:**
- `packages/core/src/ee/interfaces/audit.ts`

**Exports:**
- `AuditActor type`
- `AuditEvent type`
- `AuditFilter type`
- `IAuditLogger interface`

#### P5-Audit-Storage: Audit Storage Domain

Storage abstraction for persisting audit logs.

**Files:**
- `packages/core/src/storage/domains/audit/base.ts`
- `packages/core/src/storage/domains/audit/types.ts`
- `packages/core/src/storage/domains/audit/inmemory.ts`
- `stores/libsql/src/storage/domains/audit/index.ts`
- `stores/pg/src/storage/domains/audit/index.ts`

#### P5-Audit-API: Audit API Endpoints

API endpoints for querying audit logs.

**Files:**
- `packages/server/src/server/handlers/audit.ts`
- `packages/server/src/server/schemas/audit.ts`
- `packages/server/src/server/server-adapter/routes/audit.ts`

#### P5-Audit-UI: Audit Logs UI

Studio page for viewing audit logs.

**Files:**
- `packages/playground/src/pages/audit/index.tsx`
- `packages/playground-ui/src/domains/audit/components/audit-logs-list.tsx`
- `packages/playground-ui/src/domains/audit/components/audit-logs-tools.tsx`

#### P5-Console-Logger: Console Audit Logger

Simple audit logger that writes to console (default).

**Files:**
- `packages/core/src/ee/defaults/audit/console.ts`

### Acceptance Criteria

- [ ] Audit events capture: actor, action, resource, timestamp, metadata
- [ ] Events are logged for: agent CRUD, chat messages, workflow runs
- [ ] Audit logs can be queried with filters (actor, action, time range)
- [ ] Studio shows audit logs page with filtering/search
- [ ] Console logger works out of the box for development
- [ ] LibSQL and PostgreSQL storage adapters available

---

## Phase 6: Auth Providers

**Status:** Planned
**Priority:** Medium
**Branch:** `feat/ee-auth-providers`
**Depends On:** Phase 3

Implement specific auth provider packages that integrate with the EE system.

### Deliverables

#### P6-WorkOS: WorkOS Auth Provider

Full-featured auth provider using WorkOS AuthKit.

**Files:**
- `auth/workos/src/index.ts`
- `auth/workos/src/audit-exporter.ts`

**Features:**
- SSO via WorkOS AuthKit
- User management via WorkOS
- Roles from WorkOS organizations
- Audit export to WorkOS

#### P6-Cloud: Mastra Cloud Auth

Auth provider for Mastra Cloud (license-exempt).

**Files:**
- `auth/cloud/src/index.ts`
- `auth/cloud/src/client.ts`

### Acceptance Criteria

- [ ] WorkOS provider implements IUserProvider, ISessionProvider, ISSOProvider
- [ ] WorkOS provider can optionally implement IRBACProvider via organizations
- [ ] Mastra Cloud auth works without EE license (special case)
- [ ] Documentation for configuring each provider

---

## Implementation Notes

### License Validation

| Setting | Value |
|---------|-------|
| Environment Variable | `MASTRA_EE_LICENSE` |
| Minimum Length | 32 characters |
| Cache TTL | 60000ms (1 minute) |
| Future Work | Implement cryptographic signature verification and license server validation |

### Feature Flags

| Setting | Value |
|---------|-------|
| Available Features | `user`, `session`, `sso`, `rbac`, `acl`, `audit` |
| Default Behavior | All features enabled if license valid, none if invalid |

### Backwards Compatibility

| Scenario | Behavior |
|----------|----------|
| No License | Mastra works exactly as before - no auth, no EE features |
| Existing Auth Providers | Auth0, Clerk, Better Auth continue to work via MastraAuthProvider interface |

### Mastra Cloud Exception

Mastra Cloud auth is exempt from license requirement. Detection is via `isMastraCloudAuth` property on auth provider.

---

## Team Review Checkpoints

### After Phase 1

**Review Focus:**
- License validation approach
- Feature flag naming and granularity
- Environment variable naming (MASTRA_EE_LICENSE)
- Export structure (@mastra/core/ee)

### After Phase 2

**Review Focus:**
- Interface design for each provider type
- Composition pattern (withEE wrapper)
- Capability detection approach
- Type safety and DX
