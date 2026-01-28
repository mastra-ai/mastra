# Roadmap: Mastra Cloud Auth Plugin — API Alignment

## Overview

Align the `@mastra/auth-cloud` plugin with Cloud's API specification through four phases: build transport layer foundation, update all API paths and method signatures, integrate provider with new client, and validate with tests. Each phase depends on the previous — partial migration breaks auth completely.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Transport Layer** - Build request/response foundation with Authorization header and envelope unwrapping
- [ ] **Phase 2: API Paths + Methods** - Update all endpoints to `/api/v1/` and add token parameters
- [ ] **Phase 3: Provider Integration** - Wire `MastraCloudAuth` to use updated client signatures
- [ ] **Phase 4: Testing + Validation** - Verify TypeScript compiles and test against mocked API

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

**Plans**: TBD

Plans:
- [ ] 02-01: Update API paths and method signatures

### Phase 3: Provider Integration
**Goal**: Wire `MastraCloudAuth` to use updated client and handle `sessionToken` flow
**Depends on**: Phase 2
**Requirements**:
- `createSession()` in client removed, throws in index.ts
- `CloudUser` includes `sessionToken` field for permission lookups

**Success Criteria** (what must be TRUE):
1. `CloudUser` type includes optional `sessionToken` field
2. `handleCallback()` stores session token on returned user
3. `getPermissions(user)` uses `user.sessionToken` for API call
4. `getCurrentUser()` passes token to `client.getUser()`
5. `createSession()` throws descriptive error (interface requirement)

**Plans**: TBD

Plans:
- [ ] 03-01: Provider integration and sessionToken flow

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

**Plans**: TBD

Plans:
- [ ] 04-01: TypeScript validation and mock tests

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Transport Layer | 1/1 | ✓ Complete | 2026-01-28 |
| 2. API Paths + Methods | 0/1 | Not started | - |
| 3. Provider Integration | 0/1 | Not started | - |
| 4. Testing + Validation | 0/1 | Not started | - |
