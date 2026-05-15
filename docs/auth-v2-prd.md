# Mastra Auth v2 — Product Requirements Document

> **Last Updated:** May 15, 2026  
> **Status:** In Progress

## Overview

Mastra Auth v2 introduces a clear separation between **internal users** (your team) and **external users** (your customers). This enables teams to manage Studio access for their own members while also tracking and investigating customer activity through their agents.

## User Types

### Internal Users (Team Members)

| Aspect         | Description                                                           |
| -------------- | --------------------------------------------------------------------- |
| **Who**        | Your team — developers, admins, PMs who build and operate agents      |
| **Access**     | Mastra Studio UI — traces, experiments, agent builder, workflows      |
| **Auth**       | SSO, credentials — human authentication via `studioAuth`              |
| **Management** | Team tab in Studio — invite members, assign roles, manage permissions |
| **Example**    | "Sarah (admin) can edit agents, view all traces, manage team members" |

### External Users (Customers)

| Aspect         | Description                                                                     |
| -------------- | ------------------------------------------------------------------------------- |
| **Who**        | End users of your product who interact with agents via API                      |
| **Access**     | Your application (not Studio) — they call agents through your app               |
| **Auth**       | Whatever your app uses — could be your app's auth, API keys, JWTs via `apiAuth` |
| **Management** | Users tab in Studio — view customer activity, traces, usage                     |
| **Example**    | "Customer ABC made 500 agent calls this month, here are their traces"           |

## Goals

- **Separate auth concerns**: Team access to Studio vs customer access to APIs
- **Team management**: Admins can invite team members, assign roles, manage permissions
- **Customer visibility**: Team can view customer activity, traces, and usage
- **Backwards compatible**: Single `auth` config still works for simple setups
- **Provider agnostic**: Different providers for team (Okta) vs customers (WorkOS) if needed

## Non-Goals

- Studio should **not require auth** for projects that don't need user management
- Studio should **not replace** external identity provider admin UIs
- Studio should **not assume** a specific identity/authorization provider
- Studio should **not expose** customer PII without appropriate permissions

---

## Architecture

### Dual Auth Configuration

```
┌─────────────────────────────────────────────────────────────────┐
│                         Mastra Server                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   studioAuth (Internal/Team)          apiAuth (External/Customers)
│   ┌─────────────────────────┐         ┌─────────────────────────┐
│   │ • SSO (Okta, WorkOS)    │         │ • Your app's JWTs       │
│   │ • Credentials           │         │ • API keys              │
│   │ • Session cookies       │         │ • WorkOS, Auth0, etc    │
│   │                         │         │                         │
│   │ Controls: Studio access │         │ Controls: API access    │
│   └─────────────────────────┘         └─────────────────────────┘
│              │                                   │               │
│              │                                   │               │
│              ▼                                   ▼               │
│   ┌─────────────────────────┐         ┌─────────────────────────┐
│   │ Team RBAC               │         │ Customer RBAC (optional)│
│   │ • What can team do      │         │ • Customer tiers        │
│   │ • admin/member/viewer   │         │ • Rate limits           │
│   └─────────────────────────┘         └─────────────────────────┘
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Configuration

```typescript
// Option 1: Backwards compatible (single auth for everything)
const mastra = new Mastra({
  server: {
    auth: new MastraAuthWorkos({ ... }),  // Handles both Studio + API
    rbac: new StaticRBACProvider({ ... }),
  },
});

// Option 2: Split auth (team vs customers)
const mastra = new Mastra({
  server: {
    studioAuth: {
      provider: new MastraAuthOkta({ ... }),      // Team uses Okta
      rbac: new MastraRBACOkta({ ... }),          // Team roles
    },
    apiAuth: {
      provider: new MastraAuthWorkos({ ... }),   // Customers use WorkOS
      // Optional: customer-level RBAC for tiers
    },
  },
});

// Option 3: Team auth + simple API auth
const mastra = new Mastra({
  server: {
    studioAuth: {
      provider: new MastraAuthClerk({ ... }),
      rbac: new MastraRBACClerk({ ... }),
    },
    apiAuth: {
      provider: new MastraAuthJWT({
        issuer: 'https://myapp.com',
        audience: 'mastra-api',
        mapUserToResourceId: (user) => user.customerId,
      }),
    },
  },
});
```

### Studio UI Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                         Mastra Studio                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Team Tab (Internal Users)                               │    │
│  │  ─────────────────────────────────────────────────────── │    │
│  │  • List team members who can access Studio               │    │
│  │  • Invite new team members                               │    │
│  │  • Assign roles (admin, member, viewer)                  │    │
│  │  • Manage permissions per role                           │    │
│  │  • View team member activity                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Users Tab (External Users / Customers)                  │    │
│  │  ─────────────────────────────────────────────────────── │    │
│  │  • List customers who use your agents                    │    │
│  │  • Search/filter by customer ID, email, etc              │    │
│  │  • View usage metrics per customer                       │    │
│  │  • Filter traces by customer                             │    │
│  │  • Investigate customer activity ("Big Brother Mode")    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Provider Interface Capabilities

Auth providers can implement additional interfaces:

| Interface              | Purpose                           | Status         |
| ---------------------- | --------------------------------- | -------------- |
| `IUserProvider`        | Get current user, user by ID      | ✅ Implemented |
| `IUserListing`         | List users with pagination/search | 📋 Planned     |
| `ISessionProvider`     | Session management, refresh       | ✅ Implemented |
| `ISSOProvider`         | SSO login flow                    | ✅ Implemented |
| `ICredentialsProvider` | Email/password auth               | ✅ Implemented |
| `IRBACProvider`        | Role/permission checking          | ✅ Implemented |
| `IRBACManager`         | Role assignment/management        | ✅ Implemented |
| `IFGAProvider`         | Fine-grained authorization        | ✅ Implemented |
| `IFGAManager`          | FGA resource/role management      | ✅ Implemented |

### Supported Auth Providers

| Provider    | Package                    | SSO | Credentials | RBAC | FGA |
| ----------- | -------------------------- | --- | ----------- | ---- | --- |
| WorkOS      | `@mastra/auth-workos`      | ✅  | ❌          | ✅   | ✅  |
| Clerk       | `@mastra/auth-clerk`       | ✅  | ✅          | ✅   | ❌  |
| Auth0       | `@mastra/auth-auth0`       | ✅  | ✅          | ❌   | ❌  |
| Better Auth | `@mastra/auth-better-auth` | ✅  | ✅          | ❌   | ❌  |
| Firebase    | `@mastra/auth-firebase`    | ✅  | ✅          | ❌   | ❌  |
| Okta        | `@mastra/auth-okta`        | ✅  | ❌          | ✅   | ❌  |
| Supabase    | `@mastra/auth-supabase`    | ✅  | ✅          | ❌   | ❌  |
| Cloud       | `@mastra/auth-cloud`       | ✅  | ❌          | ✅   | ❌  |

---

## Current Implementation Status

### ✅ Fully Implemented

#### 1. Authentication Foundation

**Core Auth Infrastructure**

- `MastraAuthProvider` abstract base class
- Auth capabilities detection via `buildCapabilities()`
- License gating for EE features
- Session management with cookie-based sessions

**Auth API Routes**

- `GET /api/auth/capabilities` — Returns auth config and current user
- `GET /api/auth/me` — Returns current user info
- `POST /api/auth/sso/login` — Initiates SSO flow
- `GET /api/auth/sso/callback` — Handles SSO callback
- `POST /api/auth/logout` — Logs out user
- `POST /api/auth/refresh` — Refreshes session
- `POST /api/auth/signin` — Credentials sign-in
- `POST /api/auth/signup` — Credentials sign-up

**Login/Auth UI**

- `LoginPage` component with SSO and credentials support
- `UserAvatar` and `UserMenu` components
- `AuthStatus` component for sidebar display
- `AuthRequired` component for route protection

#### 2. RBAC (Role-Based Access Control)

**RBAC Interfaces**

- `IRBACProvider` — Read-only role/permission checking
- `IRBACManager` — Role assignment and management
- `RoleDefinition` — Type-safe role definitions
- `RoleMapping` — Provider role to Mastra permission translation

**Default Roles**

- `owner` — Full access (`*`)
- `admin` — All read/write/execute (`*:read`, `*:write`, `*:execute`)
- `member` — Read + execute access
- `viewer` — Read-only access

**Permission System**

- Permission patterns: `resource:action` (e.g., `agents:read`, `workflows:execute`)
- Wildcard support: `*`, `agents:*`, `*:read`
- Resource-scoped permissions: `agents:read:specific-id`

**RBAC Providers**

- `StaticRBACProvider` — In-memory role definitions
- `MastraRBACWorkos` — WorkOS-backed RBAC with caching
- `MastraRBACClerk` — Clerk organization roles
- `MastraRBACOkta` — Okta groups

#### 3. FGA (Fine-Grained Authorization)

**FGA Interfaces**

- `IFGAProvider` — Resource-level permission checks (`check`, `require`, `filterAccessible`)
- `IFGAManager` — Resource and role management (`assignRole`, `removeRole`, `createResource`, etc.)

**FGA Providers**

- `MastraFGAWorkos` — WorkOS FGA with resource/permission mapping

#### 4. Permission-Aware UI

**Sidebar Navigation**

- Navigation items gated by `requiredPermission` and `requiredAnyPermission`
- Items hidden if user lacks permission when RBAC enabled
- All items visible when RBAC disabled (permissive default)

**usePermissions Hook**

- `hasPermission(permission)` — Check single permission
- `hasAllPermissions(permissions)` — Check all permissions
- `hasAnyPermission(permissions)` — Check any permission
- `hasRole(role)` — Check role membership
- `canEdit(resource)`, `canDelete(resource)`, `canExecute(resource)` — Convenience methods

#### 5. E2E Test Infrastructure

- Auth role fixtures (admin/member/viewer)
- Mock user utilities for test setup
- Tests for role-based access scenarios

---

### 📋 Planned Work

#### Phase 1: studioAuth / apiAuth Separation

**Goal**: Enable separate auth providers for team (Studio) vs customers (API)

1. **Configuration Schema**
   - Add `studioAuth` and `apiAuth` to server config
   - Backwards compatible: `auth` still works as single provider
   - Each can have its own `provider`, `rbac`, and `fga`

2. **Request Routing**
   - Studio UI routes use `studioAuth`
   - API routes use `apiAuth`
   - Clear separation of session/token handling

3. **User Context Propagation**
   - External user ID from `apiAuth` flows through to traces
   - `mapUserToResourceId` for memory isolation
   - User context available in all observability data

#### Phase 2: Team Management UI

**Goal**: Allow team admins to manage Studio access

1. **Team Tab**
   - List team members from `studioAuth` provider
   - Requires `IUserListing` interface on provider
   - Search/filter team members

2. **Team Member Detail**
   - View member's roles and permissions
   - View member's recent activity in Studio

3. **Role Management**
   - Assign/remove roles (if provider supports `IRBACManager`)
   - View role definitions and permission mappings
   - Create custom roles (if supported)

4. **Invite Flow**
   - Invite new team members via email
   - Requires provider support (WorkOS invites, Clerk invites, etc.)

#### Phase 3: Customer Visibility UI

**Goal**: Allow team to view and investigate customer activity

1. **Users Tab**
   - List external users who have called APIs
   - Derived from trace data (not from `apiAuth` provider directly)
   - Search/filter by customer ID, email, metadata

2. **Customer Detail Page**
   - Usage metrics (API calls, agent runs, etc.)
   - Recent traces for this customer
   - Memory threads for this customer

3. **User Activity Investigation ("Big Brother Mode")**
   - Filter traces by customer
   - Filter memory by customer
   - Timeline view of customer interactions

#### Phase 4: Audit Logging

**Goal**: Track security-relevant events for compliance

1. **Audit Storage Domain**
   - `IAuditStorage` interface
   - Adapters: LibSQL, ClickHouse, Cloudflare, in-memory
   - Persistent storage with retention policies

2. **Audit Events**
   - Auth events: login, logout, session refresh, failed attempts
   - Admin events: role changes, permission changes, invites
   - API events: agent runs, workflow executions (with user context)

3. **Audit UI**
   - Audit logs page with filtering
   - Filter by: actor, action, outcome, date range, target user
   - Export capabilities

---

## RBAC/FGA Architecture Decisions

### RBAC Independence

RBAC is **separate from authentication**. You can mix providers:

- Auth: Better Auth (credentials)
- RBAC: StaticRBACProvider (config-based roles)

Or use integrated solutions:

- Auth + RBAC: WorkOS, Clerk, Okta (provider handles both)

### Permission Patterns

```
Format: {resource}:{action}[:{resource-id}]

Examples:
  agents:read          — Read any agent
  agents:write         — Write any agent
  agents:read:abc123   — Read specific agent
  agents:*             — All actions on agents
  *:read               — Read anything
  *                    — Full access
```

### Role Mapping

External provider roles map to Mastra permissions:

```typescript
const rbac = new MastraRBACWorkos({
  roleMapping: {
    Admin: ['*'], // Full access
    Engineering: ['agents:*', 'workflows:*'],
    Support: ['agents:read', 'observability:read'],
    _default: ['agents:read'], // Unmapped roles
  },
})
```

### FGA Model

User-centric checks: "Can this user do this action on this resource?"

```typescript
// Check if user can edit specific agent
await fga.check(user, {
  resource: { type: 'agent', id: 'agent-123' },
  permission: 'write',
})

// Filter list to only accessible resources
const accessible = await fga.filterAccessible(user, agents, {
  resourceType: 'agent',
  permission: 'read',
})
```

### Storage-Backed Authorization (Future)

For providers without native RBAC/FGA, Mastra can provide storage-backed implementations:

```typescript
// Provider doesn't have RBAC? Use MastraStorage
const mastra = new Mastra({
  server: {
    studioAuth: {
      provider: new MastraAuthBetterAuth({ ... }),
      rbac: new MastraStorageRBAC({
        storage: mastra.storage,  // Uses MastraStorage for roles
      }),
    },
  },
});
```

This enables:

- Role/permission storage in your database
- Management UI without provider dependency
- Fallback when provider lacks authorization features

---

## Migration Guide

### From v1 (single auth)

No changes required. Existing config continues to work:

```typescript
// This still works exactly as before
const mastra = new Mastra({
  server: {
    auth: myAuthProvider,
    rbac: myRBACProvider,
  },
})
```

### To v2 (split auth)

Add separate configs for team and customers:

```typescript
const mastra = new Mastra({
  server: {
    // Team auth for Studio
    studioAuth: {
      provider: new MastraAuthOkta({ ... }),
      rbac: new MastraRBACOkta({ ... }),
    },
    // Customer auth for API
    apiAuth: {
      provider: new MastraAuthJWT({ ... }),
    },
  },
});
```

---

## Changelog

| Date       | Change                                                                  |
| ---------- | ----------------------------------------------------------------------- |
| 2026-05-15 | Rewrote PRD with internal/external user model, studioAuth/apiAuth split |
| 2026-05-15 | Updated to reflect actual implementation state                          |
| 2026-01-21 | Audit logs feature removed (will be re-added)                           |
| 2026-01-15 | Audit logs feature added                                                |
