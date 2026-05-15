# Auth v2 Project Scoping & Parallelization Plan

> **Project Lead:** rphansen91  
> **Target Date:** May 26, 2026 (11 days) ⚠️ HARD DEADLINE  
> **Linear Project:** [Auth v2](https://linear.app/kepler-crm/project/auth-v2-5a23d2650c87)
> **Constraint:** Ryan on vacation May 27th

---

## Executive Summary

Auth v2 has two main goals:

1. **Separate auth concerns**: `studioAuth` (team/internal) vs `apiAuth` (customers/external)
2. **User management UI**: Team tab + Users tab in Studio

### What We Already Have (on `auth-rbac-cms` branch)

| Component                                  | Status  | LOC      |
| ------------------------------------------ | ------- | -------- |
| Auth providers (WorkOS, Clerk, Okta, etc.) | ✅ Done | ~3K      |
| RBAC interfaces + providers                | ✅ Done | ~2K      |
| FGA interfaces + WorkOS FGA                | ✅ Done | ~1.5K    |
| Permission-aware UI (sidebar, hooks)       | ✅ Done | ~1K      |
| Login/logout/SSO flows                     | ✅ Done | ~1K      |
| E2E auth tests                             | ✅ Done | ~2K      |
| **Total existing auth code**               |         | **~10K** |

### What We Need to Build

| Component                                 | Effort | Depends On               |
| ----------------------------------------- | ------ | ------------------------ |
| `studioAuth`/`apiAuth` config split       | Medium | Nothing                  |
| Request routing (studio vs API routes)    | Medium | Config split             |
| Team Tab UI                               | Large  | `IUserListing` interface |
| `IUserListing` interface + provider impls | Medium | Config split             |
| Users Tab UI (customers)                  | Medium | Trace user context       |
| User Activity Investigation               | Medium | Users Tab                |
| Audit logging (re-implementation)         | Large  | Nothing                  |

---

## Dependency Graph

```
                          ┌──────────────────────┐
                          │  P1: Config Schema   │
                          │  studioAuth/apiAuth  │
                          └──────────┬───────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
   │ P2a: IUserListing│   │ P2b: Request     │   │ P2c: User Context│
   │ Interface        │   │ Routing          │   │ in Traces        │
   └────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
            │                      │                      │
            ▼                      │                      ▼
   ┌──────────────────┐            │           ┌──────────────────┐
   │ P3a: Team Tab UI │            │           │ P3b: Users Tab UI│
   │ (list, search)   │            │           │ (customers list) │
   └────────┬─────────┘            │           └────────┬─────────┘
            │                      │                      │
            ▼                      │                      ▼
   ┌──────────────────┐            │           ┌──────────────────┐
   │ P3c: Team Member │            │           │ P3d: Customer    │
   │ Detail + Roles   │            │           │ Activity Page    │
   └────────┬─────────┘            │           └────────┬─────────┘
            │                      │                      │
            └──────────────────────┼──────────────────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  P4: Audit Logs  │
                          │  (parallel track)│
                          └──────────────────┘
```

---

## Workstreams (Parallelizable)

### 🔵 Stream A: Core Infrastructure (Backend)

**Owner:** TBD (Backend-focused)

| Issue                                        | Estimate | Dependencies | Parallelizable With |
| -------------------------------------------- | -------- | ------------ | ------------------- |
| A1: Config schema for `studioAuth`/`apiAuth` | 2d       | None         | C1, D1              |
| A2: Request routing middleware               | 2d       | A1           | B1, C2              |
| A3: Session handling per auth type           | 1d       | A1, A2       | B2                  |
| A4: `IUserListing` interface definition      | 0.5d     | None         | Everything          |
| A5: WorkOS `IUserListing` implementation     | 1d       | A4           | B2, C3              |
| A6: Clerk `IUserListing` implementation      | 1d       | A4           | A5                  |
| A7: Okta `IUserListing` implementation       | 1d       | A4           | A5, A6              |

**Stream Total:** ~8.5 days (but parallelizable to ~4 days with 2 people)

---

### 🟢 Stream B: Team Management UI (Frontend)

**Owner:** TBD (Frontend-focused)

| Issue                                      | Estimate | Dependencies | Parallelizable With |
| ------------------------------------------ | -------- | ------------ | ------------------- |
| B1: Team nav item + route structure        | 0.5d     | None         | A1, A2              |
| B2: Team list page (table, search, filter) | 2d       | A4, A5       | A6, A7              |
| B3: Team member detail page                | 1.5d     | B2           | C3                  |
| B4: Role management UI (assign/remove)     | 2d       | B3           | C4                  |
| B5: Team invite flow UI                    | 1.5d     | B4           | D3                  |
| B6: E2E tests for Team tab                 | 1d       | B2-B5        | D4                  |

**Stream Total:** ~8.5 days

---

### 🟡 Stream C: Customer Visibility UI (Frontend)

**Owner:** TBD (Frontend-focused, can be same as B)

| Issue                                        | Estimate | Dependencies | Parallelizable With |
| -------------------------------------------- | -------- | ------------ | ------------------- |
| C1: User context in trace creation           | 1d       | None         | A1                  |
| C2: API to list users from traces            | 1d       | C1           | A2                  |
| C3: Users nav item + route structure         | 0.5d     | None         | A4, B1              |
| C4: Users list page (customers table)        | 2d       | C2, C3       | B4                  |
| C5: Customer detail page                     | 1.5d     | C4           | B5                  |
| C6: Customer activity view (filtered traces) | 2d       | C5           | D3                  |
| C7: E2E tests for Users tab                  | 1d       | C4-C6        | B6                  |

**Stream Total:** ~9 days

---

### 🔴 Stream D: Audit Logging (Independent Track)

**Owner:** TBD (Can be completely separate)

| Issue                                         | Estimate | Dependencies | Parallelizable With |
| --------------------------------------------- | -------- | ------------ | ------------------- |
| D1: `IAuditStorage` interface                 | 0.5d     | None         | Everything          |
| D2: In-memory audit storage                   | 0.5d     | D1           | A1-A7               |
| D3: LibSQL audit storage                      | 1d       | D1           | B1-B5, C1-C6        |
| D4: Audit service (event logging)             | 1.5d     | D1           | B6                  |
| D5: Audit events: auth (login/logout/refresh) | 1d       | D4           | C7                  |
| D6: Audit events: admin (roles/invites)       | 1d       | D4, D5       | —                   |
| D7: Audit logs UI (list, filter)              | 2d       | D4           | —                   |
| D8: Audit log date range filter               | 0.5d     | D7           | —                   |
| D9: E2E tests for audit                       | 1d       | D7           | —                   |

**Stream Total:** ~9 days

---

## Timeline (17 days to June 1)

### Week 1 (May 15-21): Foundation

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Day 1-2: Kickoff + Config Schema                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ Stream A: A1 (config schema), A4 (IUserListing interface)               │
│ Stream D: D1 (IAuditStorage), D2 (in-memory)                            │
│ Stream B/C: B1/C3 (route structure setup)                               │
├─────────────────────────────────────────────────────────────────────────┤
│ Day 3-5: Routing + First Provider                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ Stream A: A2 (routing), A3 (sessions), A5 (WorkOS IUserListing)         │
│ Stream D: D3 (LibSQL storage), D4 (audit service)                       │
│ Stream B: B2 (team list page) - can start with mocks                    │
│ Stream C: C1 (user context in traces), C2 (list users API)              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Week 2 (May 22-28): UI Build-Out

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Day 6-8: Provider Impls + Core UI                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ Stream A: A6 (Clerk), A7 (Okta) - can parallelize                       │
│ Stream B: B2 (finish team list), B3 (member detail)                     │
│ Stream C: C4 (users list page)                                          │
│ Stream D: D5 (auth events), D6 (admin events)                           │
├─────────────────────────────────────────────────────────────────────────┤
│ Day 9-12: Management Features                                           │
├─────────────────────────────────────────────────────────────────────────┤
│ Stream B: B4 (role management), B5 (invite flow)                        │
│ Stream C: C5 (customer detail), C6 (activity view)                      │
│ Stream D: D7 (audit UI)                                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Week 3 (May 29 - June 1): Polish + Ship

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Day 13-15: Testing + Edge Cases                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Stream B: B6 (E2E tests)                                                │
│ Stream C: C7 (E2E tests)                                                │
│ Stream D: D8 (date filter), D9 (E2E tests)                              │
├─────────────────────────────────────────────────────────────────────────┤
│ Day 16-17: Integration + Release                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ All: Integration testing, docs, release prep                            │
│ Merge auth-rbac-cms + new work into main                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Resource Allocation Options

### Option 1: Solo (1 person) — 17+ days

Not recommended. Would need to prioritize and cut scope.

**MVP scope for solo:**

- ✅ Config schema + routing
- ✅ Team list (read-only)
- ❌ Role management
- ❌ Invite flow
- ❌ Users tab
- ❌ Audit logging

### Option 2: Pair (2 people) — Achievable

```
Person 1 (Backend): Stream A + Stream D
Person 2 (Frontend): Stream B + Stream C
```

Some cross-pollination needed. Tight but doable.

### Option 3: Squad (3-4 people) — Comfortable

```
Person 1: Stream A (Backend infrastructure)
Person 2: Stream B (Team UI)
Person 3: Stream C (Users UI)
Person 4: Stream D (Audit - can be part-time)
```

All streams fully parallel. Buffer time for integration.

---

## Risk Assessment

| Risk                              | Impact | Likelihood | Mitigation                                   |
| --------------------------------- | ------ | ---------- | -------------------------------------------- |
| Provider API differences          | High   | Medium     | Design `IUserListing` to be minimal/flexible |
| Auth-rbac-cms conflicts with main | Medium | Medium     | Merge early, often                           |
| Audit scope creep                 | High   | High       | Time-box audit to core events only           |
| WorkOS/Clerk API rate limits      | Medium | Low        | Add caching to listing APIs                  |
| E2E test flakiness                | Medium | Medium     | Invest in reliable test fixtures             |

---

## MVP vs Full Scope

### MVP (Must Have for May 26) ⚠️

- [ ] Merge `auth-rbac-cms` into `auth-vnext`
- [ ] `studioAuth`/`apiAuth` config split
- [ ] Request routing (which auth for which route)
- [ ] Team list page (read members)
- [ ] Users list page (customers from traces)
- [ ] Basic user detail pages
- [ ] Role management UI (assign/remove roles)

### Cut (Post-Vacation)

- ~~Invite flow~~
- ~~Customer activity investigation~~
- ~~Audit logging~~
- ~~Additional provider support (Clerk, Okta IUserListing)~~

---

## Proposed Linear Issues

### Epic: Auth v2 Core Infrastructure

1. `[PLTFRM] Add studioAuth/apiAuth config schema`
2. `[PLTFRM] Implement request routing middleware`
3. `[PLTFRM] Add session handling per auth type`
4. `[PLTFRM] Define IUserListing interface`
5. `[PLTFRM] Implement IUserListing for WorkOS`
6. `[PLTFRM] Implement IUserListing for Clerk` (nice-to-have)
7. `[PLTFRM] Implement IUserListing for Okta` (nice-to-have)

### Epic: Team Management UI

1. `[PLTFRM] Add Team nav item and route structure`
2. `[PLTFRM] Build Team list page with search/filter`
3. `[PLTFRM] Build Team member detail page`
4. `[PLTFRM] Add role management UI` (nice-to-have)
5. `[PLTFRM] Add team invite flow` (nice-to-have)
6. `[PLTFRM] E2E tests for Team management`

### Epic: Customer Visibility UI

1. `[PLTFRM] Add user context to trace creation`
2. `[PLTFRM] API to list users from trace data`
3. `[PLTFRM] Add Users nav item and route structure`
4. `[PLTFRM] Build Users list page (customers)`
5. `[PLTFRM] Build Customer detail page`
6. `[PLTFRM] Add customer activity investigation view` (nice-to-have)
7. `[PLTFRM] E2E tests for Users tab`

### Epic: Audit Logging (Separate Track)

1. `[PLTFRM] Define IAuditStorage interface`
2. `[PLTFRM] Implement in-memory audit storage`
3. `[PLTFRM] Implement LibSQL audit storage`
4. `[PLTFRM] Build audit service for event logging`
5. `[PLTFRM] Add auth audit events (login/logout)`
6. `[PLTFRM] Add admin audit events (roles/invites)`
7. `[PLTFRM] Build audit logs UI`
8. `[PLTFRM] E2E tests for audit logging`

---

## Next Steps

1. **Decide resource allocation** — How many people on this?
2. **Prioritize MVP vs nice-to-have** — What must ship June 1?
3. **Create Linear issues** — From the list above
4. **Merge `auth-rbac-cms` foundation** — Get existing work into `auth-vnext`
5. **Assign owners to streams** — Who does what?

---

## Questions to Answer

1. **Which providers are must-have for IUserListing?**
   - WorkOS only? Clerk too? All of them?

2. **Is audit logging MVP or nice-to-have?**
   - It was removed before — what's the priority now?

3. **Customer visibility scope?**
   - Just list + basic detail, or full investigation tools?

4. **Who's available to work on this?**
   - Determines which option (solo/pair/squad) we go with

5. **Any external deadlines driving June 1?**
   - Can we slip if needed, or is it hard deadline?
