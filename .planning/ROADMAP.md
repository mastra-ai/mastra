# Roadmap: Mastra Cloud Auth Plugin — API Alignment

## Overview

Align the `@mastra/auth-cloud` plugin with Cloud's API specification through four phases: build transport layer foundation, update all API paths and method signatures, integrate provider with new client, and validate with tests. Each phase depends on the previous — partial migration breaks auth completely.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Transport Layer** - Build request/response foundation with Authorization header and envelope unwrapping
- [x] **Phase 2: API Paths + Methods** - Update all endpoints to `/api/v1/` and add token parameters
- [x] **Phase 3: Provider Integration** - Wire `MastraCloudAuth` to use updated client signatures
- [x] **Phase 4: Testing + Validation** - Verify TypeScript compiles and test against mocked API
- [x] **Phase 5: RBAC 403 Error Handling** - Fix playground retry behavior and fallback on 403 RBAC errors
- [x] **Phase 6: WorkOS Client Initialization** - Make WorkOS client initialization consistent between providers
- [x] **Phase 7: Strict Permission Types** - Type RoleDefinition.permissions to only allow valid STUDIO_PERMISSIONS strings

## Phase Details

### Phase 1: Transport Layer

**Goal**: Establish HTTP request/response foundation that all endpoints will use
**Depends on**: Nothing (first phase)
**Requirements**:

- Bearer token in Authorization header
- Response envelope unwrapping from `{ ok, data }`

**Success Criteria** (what must be TRUE):

1. `request<T>()` method sends `Authorization: Bearer <token>` header when token provided
2. `unwrapResponse<T>()` extracts data from `{ ok, data }` envelope
3. `CloudApiResponse<T>` type defined matching Cloud spec
4. `CloudApiError` thrown with structured error info on failure

**Plans**: 1 plan

Plans:

- [x] 01-01-PLAN.md — Transport layer types and request helper

### Phase 2: API Paths + Methods

**Goal**: Update all endpoints to match Cloud spec paths and accept token parameters
**Depends on**: Phase 1
**Requirements**:

- API paths use `/api/v1/` prefix and `/auth/oss` login endpoint
- `getUser()` and `getUserPermissions()` accept token parameter

**Success Criteria** (what must be TRUE):

1. `getLoginUrl()` returns URL with `/auth/oss` path
2. All authenticated endpoints use `/api/v1/` prefix
3. `getUser(userId, token)` signature accepts token parameter
4. `getUserPermissions(userId, token)` signature accepts token parameter
5. All methods use transport layer from Phase 1

**Plans**: 1 plan

Plans:

- [x] 02-01-PLAN.md — Update config, option interfaces, and migrate all methods to request<T>()

### Phase 3: Provider Integration

**Goal**: Wire `MastraCloudAuth` to use updated client and handle `sessionToken` flow
**Depends on**: Phase 2
**Requirements**:

- `createSession()` throws descriptive CloudApiError (Cloud doesn't support)
- `CloudUser` includes required `sessionToken` field for permission lookups
- Permissions resolved locally via JWT decode + resolvePermissions()

**Success Criteria** (what must be TRUE):

1. `CloudUser` type includes required `sessionToken` field
2. `handleCallback()` decodes JWT locally and stores token on returned user
3. `getPermissions(user)` extracts role from JWT, uses `resolvePermissions()` from core
4. `createSession()` throws CloudApiError with 501 status
5. `getCurrentUser()` decodes sessionToken JWT locally to get user info (NO API call)
6. TypeScript compiles without errors

**Plans**: 1 plan

Plans:

- [x] 03-01-PLAN.md — Provider integration and sessionToken flow

### Phase 4: Testing + Validation

**Goal**: Verify TypeScript compiles and all changes work against mocked API
**Depends on**: Phase 3
**Requirements**:

- TypeScript compiles without errors

**Success Criteria** (what must be TRUE):

1. `pnpm typecheck` passes for `auth/cloud` package
2. All auth flow paths covered with mocked responses
3. Error paths return appropriate errors (not swallowed)
4. No regressions in existing interface implementations

**Plans**: 1 plan

Plans:

- [x] 04-01-PLAN.md — Vitest setup and unit tests for transport + provider layers

### Phase 5: RBAC 403 Error Handling

**Goal**: Fix playground retry behavior and fallback on 403 RBAC errors
**Depends on**: Phase 4
**Requirements**:

- On 403 response, do not retry the request
- Immediately display existing "Permission Denied" page
- Fix in playground or playground-ui package

**Success Criteria** (what must be TRUE):

1. 403 responses are not retried
2. 403 errors route to Permission Denied page immediately
3. No fallback to "no agents created" docs page on 403
4. Other error codes retain existing behavior

**Plans**: 4 plans

Plans:

- [x] 01-PLAN.md — 403 error detection and query retry handling (wave 1)
- [x] 02-PLAN.md — PermissionDenied UI component (wave 1)
- [x] 03-PLAN.md — Integrate 403 handling in domain hooks and tables (wave 2)
- [x] 04-PLAN.md — Update page components to pass error props (wave 3)

### Phase 6: WorkOS Client Initialization

**Goal**: Make WorkOS client initialization consistent between MastraAuthWorkOS and MastraRBACWorkOS
**Depends on**: Phase 5
**Requirements**:

- MastraRBACWorkOS should initialize WorkOS client internally (like MastraAuthWorkOS)
- Remove requirement to pass pre-instantiated WorkOS client

**Success Criteria** (what must be TRUE):

1. MastraRBACWorkOS constructor accepts config options, not WorkOS instance
2. WorkOS client initialized internally in MastraRBACWorkOS
3. API matches MastraAuthWorkOS pattern
4. TypeScript compiles without errors

**Plans**: 1 plan

Plans:
- [x] 06-01-PLAN.md — Update types, constructor, and package documentation

### Phase 7: Strict Permission Types

**Goal**: Type RoleDefinition.permissions field to only allow valid permission strings from STUDIO_PERMISSIONS
**Depends on**: Phase 6
**Requirements**:

- Extract permission string literal type from STUDIO_PERMISSIONS object
- Update RoleDefinition.permissions to use strict type instead of string[]

**Success Criteria** (what must be TRUE):

1. RoleDefinition.permissions typed as array of valid permission literals
2. Invalid permission strings cause TypeScript errors
3. TypeScript compiles without errors
4. No breaking changes to runtime behavior

**Plans**: 1 plan

Plans:
- [x] 07-01-PLAN.md — Define Permission type and update RoleDefinition interface

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase                      | Plans Complete | Status     | Completed  |
| -------------------------- | -------------- | ---------- | ---------- |
| 1. Transport Layer         | 1/1            | ✓ Complete | 2026-01-28 |
| 2. API Paths + Methods     | 1/1            | ✓ Complete | 2026-01-29 |
| 3. Provider Integration    | 1/1            | ✓ Complete | 2026-01-29 |
| 4. Testing + Validation    | 1/1            | ✓ Complete | 2026-01-28 |
| 5. RBAC 403 Error Handling | 4/4            | ✓ Complete | 2026-01-30 |
| 6. WorkOS Client Init      | 1/1            | ✓ Complete | 2026-01-30 |
| 7. Strict Permission Types | 1/1            | ✓ Complete | 2026-01-30 |
