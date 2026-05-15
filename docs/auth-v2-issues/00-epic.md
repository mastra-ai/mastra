# Epic: Auth v2 — Studio Auth + Team Management

## Overview

Add dedicated Studio authentication separate from API auth. Enable team management, role definitions, and customer visibility in Studio.

## Goals

- New `studio` config block for Studio-specific auth/rbac/fga
- Team can manage Studio access and roles (create/edit/delete roles, assign to users)
- Team can view customer list and activity

## Configuration

```typescript
const mastra = new Mastra({
  // Existing — unchanged, for API authentication
  server: {
    auth: apiAuthProvider,
    rbac: apiRbacProvider,
  },

  // New — for Studio UI authentication
  studio: {
    auth: studioAuthProvider,
    rbac: studioRbacProvider,
  },
})
```

## Deadline

**May 26, 2026** (hard deadline — Ryan on vacation May 27)

## Out of Scope (MVP)

- Audit logging
- Trace-based user fallback (when provider doesn't support IUserListing)
- Additional provider implementations (Clerk, Okta) — WorkOS only for MVP

---

## Key Decisions

| Question                       | Decision                                       |
| ------------------------------ | ---------------------------------------------- |
| Config structure               | Top-level `studio` block (not inside `server`) |
| Unauthenticated studio request | 401 + login redirect (no server.auth fallback) |
| Team tab visibility            | `team:read` permission required                |
| `team:read` default roles      | owner, admin, member (not viewer)              |
| Role modification permission   | `team:write` (admin/owner have by default)     |
| Users data source              | Auth provider only (IUserListing)              |
| Users tab when unsupported     | Show empty state with explanation              |
| Users tab visibility           | `users:read` permission required               |
| `users:read` default roles     | owner, admin, member (not viewer)              |
| Customer trace filtering       | Yes, link to `/traces?userId=<id>`             |
| IUserListing providers (MVP)   | WorkOS only                                    |
| Navigation naming              | "Team" and "Users"                             |
| E2E tests                      | MVP requirement                                |
| Config schema priority         | P0 (required for routing)                      |

---

## Summary

| #   | Issue                                                           | Priority | Estimate  | Depends On  |
| --- | --------------------------------------------------------------- | -------- | --------- | ----------- |
| 00a | Add permissions to DEFAULT_ROLES                                | P1       | 0.5d      | —           |
| 01  | **Config schema (studio config)**                               | **P0**   | 1d        | —           |
| 02  | **Request routing middleware**                                  | **P0**   | 1.5d      | 01          |
| 03  | Interfaces (IUserListing, IInvitations, IRoleDefinitionManager) | P1       | 1d        | —           |
| 04  | WorkOS implementations                                          | P1       | 2d        | 03          |
| 05  | Team list page + invite flow                                    | P1       | 2.5d      | 02, 04, 00a |
| 06  | Team member detail page                                         | P1       | 1.5d      | 05          |
| 07  | Role assignment UI                                              | P1       | 1.5d      | 06, 07a     |
| 07a | **Role definitions management**                                 | **P1**   | 2.5d      | 04          |
| 08  | Users list page (customers)                                     | P1       | 2d        | 02, 04, 00a |
| 09  | Customer detail page                                            | P1       | 1.5d      | 08          |
| 10  | E2E tests                                                       | P1       | 2d        | 07, 09      |
|     | **Total**                                                       |          | **19.5d** |             |

**With 2 people parallel: ~10-11 working days** ← We're doing this

---

## Workstream Breakdown (2 people, 11 days)

### Person A: Backend + Infrastructure

| Day  | Task                                                            | Issue         |
| ---- | --------------------------------------------------------------- | ------------- |
| 1    | Config schema (studioAuth/apiAuth)                              | 01            |
| 2-3  | Request routing middleware                                      | 02            |
| 4    | Interfaces (IUserListing, IInvitations, IRoleDefinitionManager) | 03            |
| 5-6  | WorkOS implementations                                          | 04            |
| 7-8  | Role definitions backend + API                                  | 07a (backend) |
| 9-10 | API polish, edge cases, testing                                 | —             |
| 11   | Buffer / bug fixes                                              | —             |

### Person B: Frontend + UI

| Day   | Task                                       | Issue          |
| ----- | ------------------------------------------ | -------------- |
| 1-2   | Permissions to DEFAULT_ROLES + scaffolding | 00a            |
| 3-4   | Team list page + invite modal              | 05             |
| 5     | Team member detail page                    | 06             |
| 6-7   | Role definitions UI (list, create, edit)   | 07a (frontend) |
| 7-8   | Role assignment UI                         | 07             |
| 8-9   | Users list + customer detail               | 08, 09         |
| 10-11 | E2E tests                                  | 10             |

### Critical Path

```
Day 1-3:  [A] 01 → 02 (config + routing) — blocks everything
Day 3:    [B] Can start 05 once routing merged
Day 4-6:  [A] 03 → 04 (interfaces + WorkOS) — [B] continues UI
Day 7+:   Both can work independently
```

### Risk Mitigation

- **Day 3 checkpoint:** Routing must be merged or we're blocked
- **Day 6 checkpoint:** WorkOS implementations must work or descope
- **Day 9 checkpoint:** Core features done, only polish/tests remain

---

## Security Model

The `x-mastra-client-type: studio` header routes requests to the appropriate auth provider:

- **Studio requests** (header present) → `studioAuth` provider
- **API requests** (no header) → `apiAuth` provider

**Security boundary is the session, not the header:**

1. External user spoofs `x-mastra-client-type: studio` header
2. Server routes to `studioAuth` (e.g., Okta)
3. Okta checks for valid SSO session
4. No valid session → **401 + login redirect**
5. External user cannot access Studio without valid studio session

---

## New Permissions

| Permission   | Description       | Default Roles        |
| ------------ | ----------------- | -------------------- |
| `team:read`  | View team members | owner, admin, member |
| `team:write` | Modify roles      | owner, admin         |
| `users:read` | View customers    | owner, admin, member |

---

## Dependency Graph

```
00a Permissions ────────────────────────────────────────────┐
                                                            │
01 Config (P0) ─────────────────┐                           │
                                │                           │
                                ▼                           │
03 Interfaces (P1) ───► 02 Routing (P0) ────────────────────┤
        │                       │                           │
        ▼                       │                           │
04 WorkOS (P1) ─────────────────┤                           │
        │                       │                           │
        ├───────────────┐       │                           │
        │               │       │                           │
        ▼               │       │                           │
07a Role Defs ──────────┤       │                           │
        │               │       │                           │
        │       ┌───────┴───────┴───────┐                   │
        │       │                       │                   │
        │       ▼                       ▼                   │
        │   05 Team List ◄──────── 08 Users List ◄──────────┘
        │       │                       │
        │       ▼                       ▼
        │   06 Team Detail         09 Customer Detail
        │       │                       │
        └──►07 Role Assign ─────────────┘
                │                       │
                └───────┬───────────────┘
                        │
                        ▼
                   10 E2E Tests
```

---

## Issues

1. [01-config-schema.md](./01-config-schema.md) — Config schema for studioAuth/apiAuth **(P0)**
2. [02-request-routing.md](./02-request-routing.md) — Request routing middleware **(P0)**
3. [03-iuserlisting-interface.md](./03-iuserlisting-interface.md) — IUserListing interface
4. [04-workos-userlisting.md](./04-workos-userlisting.md) — WorkOS IUserListing implementation
5. [05-team-list-page.md](./05-team-list-page.md) — Team list page
6. [06-team-member-detail.md](./06-team-member-detail.md) — Team member detail page
7. [07-role-management-ui.md](./07-role-management-ui.md) — Role management UI
8. [08-users-list-page.md](./08-users-list-page.md) — Users list page (customers)
9. [09-customer-detail-page.md](./09-customer-detail-page.md) — Customer detail page
10. [10-e2e-tests.md](./10-e2e-tests.md) — E2E tests for auth v2
