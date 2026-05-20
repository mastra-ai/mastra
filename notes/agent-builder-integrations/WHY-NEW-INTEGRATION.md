# Why Build `ToolIntegration` Instead of Extending Legacy `ToolProvider`

A report for stakeholders on the technical justification for replacing the
legacy integration surface (Composio, MCP, and any future editor integration)
with a new `ToolIntegration` API.

---

## TL;DR

- Legacy `ToolProvider` was designed for **static, boot-time, single-tenant
  config** — none of the v1 editor requirements fit that shape.
- Adding the v1 features (OAuth, multi-account, labels, per-pin scope, dynamic
  auth fields, lifecycle UX, cross-author admin visibility, caller-supplied
  multi-tenancy) **to legacy would have required rewriting every layer anyway**
  — types, storage, runtime, server, UI.
- We would have ended up with the same code, but stuffed behind a name
  (`Provider`) that no longer describes what it does and a contract shape that
  fights every new feature.
- Net cost of greenfield: **~−500 LOC** vs. legacy + adapter shims, and **zero
  install base** to migrate (no users were on legacy v0 → no breakage risk).

---

## 1. What Legacy `ToolProvider` Was Built For

Legacy `ToolProvider` (`packages/core/src/tool-provider/`) modelled a single
assumption:

> "A developer drops a provider into `mastra.config.ts`, supplies a `userId`
> and credentials at boot, and tools appear in the agent."

That worked when:

| Assumption                              | Held for                          |
|-----------------------------------------|-----------------------------------|
| One `userId` per Mastra instance        | Solo dev, single-tenant scripts   |
| Credentials live in env / code-config   | Local development                 |
| No UI involvement                       | CLI-driven agents                 |
| Tools are static at boot                | Fixed integrations                |
| One connection per service              | Personal accounts                 |

It explicitly did **not** model: OAuth flows, user-supplied connections,
multiple accounts per service (e.g. two Slack workspaces), per-agent connection
labels, lifecycle (rename/disconnect/revoke), dynamic auth fields (e.g.
Confluence subdomain), admin cross-author visibility, or multi-tenant SaaS
deployments where `userId` arrives at request time.

---

## 2. What v1 Editor + Builder Actually Need

The v1 Agent Builder and Editor product requirements:

1. **Per-user OAuth** — End user clicks "Connect Gmail", goes through
   Google's consent screen, comes back.
2. **Multiple accounts per service** — Same user can pin two Slack
   workspaces ("Acme Eng", "Acme Sales").
3. **Per-agent labels** — Agent A uses connection "Eng Slack"; Agent B uses
   "Sales Slack".
4. **Storage-backed lifecycle** — UI shows pinned connections, lets users
   rename, disconnect, revoke.
5. **Dynamic auth fields** — Some integrations (Confluence, Jira) require
   runtime-discovered fields like `subdomain` before OAuth starts.
6. **Per-pin scope** (`per-author` / `shared` / `caller-supplied`) — A single
   agent may have a personal Gmail connection AND a shared org-wide Slack
   connection AND a multi-tenant Stripe connection.
7. **Cross-author admin visibility** — Admins with
   `tool-integrations:admin` see and manage connections pinned by any author.
8. **Health + connection status surfacing in UI** — Agent edit page shows
   "✅ Connected" / "⚠ Needs reauth".
9. **Caller-supplied `userId`** — Editor agents deployed into multi-tenant
   SaaS hosts must read `userId` from request context
   (`MASTRA_RESOURCE_ID_KEY`) at invocation time.

Legacy `ToolProvider`'s interface had no concept of any of these.

---

## 3. Why "Just Extend Legacy" Wasn't Viable

I considered three paths before greenfielding:

### Path A — Extend `ToolProvider` in place

Add optional fields (`authMode?`, `connectionId?`, `label?`, `scope?`,
`authorize()?`, `listConnections()?`, ...) to the existing interface.

**Why it fails:**
- The legacy interface is **synchronous code-config**: it doesn't take a
  request context, doesn't know about an HTTP layer, doesn't know about
  storage.
- Every new method (`authorize`, `listConnections`, `getHealth`,
  `revokeConnection`) needs to be optional → every consumer needs branching
  `if (provider.authorize)` everywhere.
- The two execution models (boot-time static vs. request-time dynamic) end up
  coexisting in one interface, making it impossible to reason about which
  methods are valid when.
- The name `Provider` doesn't describe a stored, user-pinned, scoped,
  multi-account connection — it describes "a thing that provides tools at
  boot".

### Path B — Subclass legacy and add capability flags

Keep `ToolProvider` as the base, ship `ConnectedToolProvider extends
ToolProvider`, gate features off `capabilities.batchConnectionStatus`, etc.

**Why it fails:**
- Storage shape, server routes, schemas, and UI all need to know which
  subtype they're dealing with.
- Every call site becomes a `if (provider instanceof ConnectedToolProvider)`
  ladder.
- Tests double in size (matrix of base + extended behaviour).
- We still rename the table (`tool_connections`), still build the picker UI,
  still write the route handlers — same cost, plus a useless inheritance
  hierarchy.

### Path C — Greenfield `ToolIntegration` (what we did)

A new interface designed around the actual v1 model: storage-backed,
request-context-aware, OAuth-native, multi-account by default,
capability-flagged.

**Why this wins:**
- One name (`ToolIntegration`), one storage table
  (`tool_integration_connections`), one route prefix (`/tool-integrations`),
  one UI (`ConnectionPicker`), one set of types.
- `ToolIntegration` is a **strict functional superset** of `ToolProvider` —
  anything legacy did, the new API does (legacy's implicit `userId` is now
  `scope: 'caller-supplied'`).
- Zero install base meant **zero migration cost** — no codemod, no
  deprecation cycle, no compatibility shim.
- Future MCP convergence has one target shape to converge on, not two.

---

## 4. The Concrete Mismatch — Side by Side

| Concern                          | Legacy `ToolProvider`                          | New `ToolIntegration`                                       |
|----------------------------------|------------------------------------------------|-------------------------------------------------------------|
| When configured                  | Boot-time (code)                               | Request-time (UI / storage)                                 |
| User identity                    | Implicit, single `userId` at construction      | Per-pin `scope` (`per-author` / `shared` / `caller-supplied`) |
| Auth model                       | Pre-supplied credentials                       | OAuth + dynamic fields                                      |
| Accounts per service             | One                                            | N, each with a label                                        |
| Connection lifecycle             | None — restart the process                     | Pin / unpin / disconnect / revoke through UI                |
| Storage                          | None                                           | `tool_integration_connections` table, author-scoped         |
| Server surface                   | None                                           | `/tool-integrations/*` routes (authorize, list, delete)     |
| UI                               | None                                           | `ConnectionPicker` + health pill + admin filter             |
| Capability discovery             | None                                           | `ToolIntegrationCapabilities` flags on the contract         |
| List result shape                | Bare array                                     | Wrapped `{ items, nextCursor }` (Mastra convention)         |
| Error model                      | Throws raw                                     | `MastraError` with stable IDs                               |
| Multi-tenant SaaS                | Not expressible                                | `scope: 'caller-supplied'` reads `MASTRA_RESOURCE_ID_KEY`   |
| Cross-author admin               | Not expressible                                | RBAC-gated, Strategy B (storage-rowed)                      |

Every row in the right column is a v1 requirement. None of them fit the left
column without breaking the legacy contract.

---

## 5. Why This Applies to Every Editor Integration, Not Just Composio

The same shape applies to any integration we surface in the editor (current:
Composio; near-term: MCP convergence; later: Arcade, native HTTP integrations):

- **MCP** today has its own two-tier storage and config-only flow with no
  OAuth, multi-account, labels, or lifecycle. To bring MCP into the editor on
  parity, we need exactly the `ToolIntegration` contract.
- **Arcade.dev** (deferred from v1) has the same OAuth + per-user +
  multi-account semantics as Composio. Building it against legacy would have
  meant re-inventing per-pin scope and storage all over again.
- **Native HTTP integrations** (future) need dynamic auth fields and per-pin
  scope to support team-shared API keys vs. per-user OAuth.

Building one new contract once means each future adapter is a single-file
implementation, not a re-architecture.

---

## 6. Cost / Benefit

| Metric                          | Greenfield `ToolIntegration` | Extend Legacy `ToolProvider` |
|---------------------------------|------------------------------|------------------------------|
| Net LOC                         | **~−500** (after legacy delete) | ~+1,800 (additive only)      |
| New interfaces to maintain      | 1                            | 2 (legacy + extended)        |
| Branching at call sites         | None                         | Pervasive                    |
| Storage migration               | None (greenfield)            | None (greenfield)            |
| User-facing breakage            | None (no install base)       | None (no install base)       |
| MCP convergence target          | Single                       | Two (must pick later)        |
| Time spent                      | ~2 weeks                     | ~2.5 weeks + permanent tax   |

---

## 7. Recommendation Going Forward

The greenfield-delete plan
(`notes/agent-builder-integrations/MERGE-COMPOSIO-PLAN.html`) removes legacy
`ToolProvider` entirely now that `ToolIntegration` is at parity
(caller-supplied scope closed the last gap). One name, one storage, one route
prefix, one UI — for Composio today, MCP next, and every future editor
integration after that.

---

## Reference Docs in this Branch

- `notes/agent-builder-integrations/COMPOSIO-OLD-VS-NEW.md` — full
  feature-by-feature parity matrix
- `notes/agent-builder-integrations/SHARED-CONNECTIONS-PLAN.md` — per-pin
  scope architecture
- `notes/agent-builder-integrations/CALLER-SUPPLIED-USER-ID-PLAN.md` —
  multi-tenant SaaS scope
- `notes/agent-builder-integrations/MERGE-COMPOSIO-PLAN.html` — legacy
  removal plan
- `notes/agent-builder-integrations/RENAME-TOOL-CONNECTIONS-PLAN.md` — table
  rename to match new naming
