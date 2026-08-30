# Agent Version Labels: Initial Implementation Guide

**Status:** Working implementation summary

**Date:** 2026-08-30

**Initial product scope:** Stored agents only

## Purpose

This is the short, operational guide for implementing Mastra's first agent version-label release. It is intended for maintainers, product partners, and coding agents who need the framework, sequencing, and non-negotiable decisions without rereading every PRD before each change.

The detailed PRDs remain authoritative:

- [Storage and shared contract](./agent-version-labels-storage-prd.md)
- [API, runtime, SDK, and tracing](./agent-version-labels-api-runtime-prd.md)
- [Studio UX and customer pilot](./agent-version-labels-studio-ux-prd.md)
- [Expansion backlog](./agent-version-labels-backlog-prd.md)

The earlier [Named Version Labels and Entity Tags](./version-labels-and-entity-tags-prd.md) document is background research. If it conflicts with the focused PRDs or this guide, the focused PRDs win.

## The feature in one paragraph

Mastra already has immutable agent versions, version history, exact-version lookup, and one active version. This work adds real custom labels such as `staging` or `pr-101` as movable pointers to those immutable versions. `production` remains a computed name for the existing `activeVersionId`, and `latest` remains a computed name for the newest version. A new run may select a label, but the runtime resolves it once to an immutable version ID and uses that exact ID for the rest of the run. Traces retain both how the run was selected and what actually executed.

The core mental model is:

> Versions are immutable snapshots. Labels are mutable pointers. Runs execute pinned snapshots, never moving pointers.

## Fixed decisions

| Topic | Decision |
| --- | --- |
| Initial entity | Agents only. Shared internals must be reusable later. |
| Custom labels | Real persisted pointers; they are not aliases for version IDs. |
| `production` | Reserved and computed strictly from `activeVersionId`; move it through activation. |
| `latest` | Reserved, computed, and read-only; it points to the newest version. |
| Missing explicit selection | Fail closed. Never silently fall back to another version. |
| Run behavior | Resolve once, pin the immutable version ID, and never re-resolve during the run. |
| Supported storage | InMemory, Filesystem, LibSQL/Turso, and PostgreSQL/PostgreSQL VNext. |
| Unsupported storage | Capability-gated with a typed error. |
| Source-controlled agents | Out of scope and in the backlog. |
| Permissions | Reuse existing stored-agent read/publish and agent read/execute permissions. |
| Public execution coverage | Every public agent path that hydrates a versioned agent. |
| Observability | Immutable version ID is canonical; selected label is additional provenance. |
| Dependency behavior | A root label does not propagate to prompt blocks, skills, scorers, tools, or sub-agents. |
| Tags | Separate future metadata primitive; do not represent tags as labels. |

Changing any row in this table is a product or architecture decision, not a local implementation detail. Stop and update the PRDs before changing it.

## Existing plumbing to reuse

Do not build a second version system. Extend these existing seams:

- `VersionedStorageDomain` remains the shared versioned-storage abstraction.
- `VersionedStorageDomain.getByIdResolved` remains the storage-level resolution entry point.
- `VersionResolutionOptions` gains a mutually exclusive label branch.
- Existing immutable agent version records remain the executable artifacts.
- Existing `activeVersionId` and activation remain the only production pointer and movement path.
- Existing version listing, comparison, restore, and deletion remain in place.
- Existing `AgentVersionIdentifier` and `VersionOverrides` evolve into the canonical selector model.
- Existing stored-agent routes, server authorization, JavaScript resources, and Studio version history are extended.
- Existing trace `entityVersionId` remains the canonical record of what ran.

The first correctness fix is part of this work: explicit version resolution must verify that the version belongs to the requested agent and must not return the thin entity or another fallback when the exact version is missing.

## New plumbing to build

- An optional, generic version-label channel on versioned storage domains.
- Normalized custom-label persistence, indexes, migrations, and adapter capability reporting.
- Atomic compare-and-swap for custom-label create, move, and delete.
- Retention and deletion protection for custom-labeled versions.
- A canonical label-aware selector across core, server schemas, SDKs, runtime, and evals.
- Agent label-management endpoints and JavaScript client methods.
- Root selector support through `versions.self` without breaking the existing sub-agent map.
- Resolution and immutable pinning on every public execution path.
- Durable pin persistence for suspend, resume, approval, retry, and recovery.
- Label-aware trace and evaluation provenance.
- Version-history badges, label management, playground/eval selection, promotion, rollback, and conflict UX in Studio.
- A shared adapter conformance suite and a public-route audit test matrix.

## Storage contract

### Logical record

Only custom labels are stored. `production` and `latest` are computed.

```ts
interface VersionLabelPointer {
  entityType: string;
  entityId: string;
  label: string;
  versionId: string;
  revisionToken: string;
  createdAt: Date;
  updatedAt: Date;
}
```

Storage scope—tenant, workspace, namespace, or an adapter-owned equivalent—is part of every key and operation even when it is not an explicit column.

Database adapters use a normalized relation equivalent to:

```text
version_labels
  storage_scope
  entity_type
  entity_id
  label
  version_id
  revision_token
  created_at
  updated_at
```

Required properties:

- uniqueness on scope + entity type + entity ID + label;
- reverse lookup by entity and version for retention checks;
- validation that a target version exists and belongs to the same scoped entity;
- atomicity between pointer mutations and entity/version deletion;
- whole-agent deletion cleans up its labels;
- deleting one version never silently cascades its labels.

### Label names

- 1–64 lowercase ASCII characters;
- match `^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$`;
- no whitespace, slash, uppercase, Unicode lookalikes, or leading/trailing punctuation;
- `production` and `latest` are reserved;
- reject invalid input rather than trimming or normalizing it;
- store labels as data, never as SQL identifiers or raw filesystem path components.

### Compare-and-swap

Every custom-label mutation is conditional:

- `expectedRevisionToken: null` means create only if absent;
- a string means mutate only if the current pointer has that revision;
- each successful create or move returns a fresh opaque revision token;
- a deleted and recreated label must not reuse an old token;
- two moves from the same observed state produce one winner and one conflict;
- Studio never blindly retries a conflict.

Movement is idempotent when the desired target already matches. Deletion is also safely retryable, but a stale delete must never remove a newly recreated label.

### Retention

A custom label is a hard reference:

- automatic cleanup must skip its target;
- manual target deletion returns `VERSION_IN_USE_BY_LABEL`;
- movement protects the new target and releases the old one atomically;
- deleting a label never deletes its version;
- `production` keeps the existing active-version protection;
- `latest` creates no retention protection.

## Selector and resolution contract

### Canonical public selector

```ts
type VersionSelector =
  | { versionId: string; label?: never; status?: never }
  | { label: string; versionId?: never; status?: never }
  | { status: 'draft' | 'published'; versionId?: never; label?: never };

type VersionOverrides = {
  self?: VersionSelector;
  agents?: Record<string, VersionSelector>;
  defaultStatus?: 'draft' | 'published';
};
```

`VersionResolutionOptions` receives the equivalent label branch but may retain the internal-only `archived` status. Public schemas must not expose `archived`.

### Transport

- GET and read-like requests use exactly one of `label`, `versionId`, or `status` in the query.
- JSON execution requests use `versions.self`.
- Direct HTTP execution may also accept the root query selector for curl and migration ergonomics.
- Identical query and body selectors are allowed; disagreement returns `INVALID_VERSION_SELECTOR`.
- The SDK must not silently choose one selector over another.

### Resolution matrix

| Selector | Resolution |
| --- | --- |
| `{ versionId }` | Load that exact version, verify agent ownership, or fail. |
| `{ label: 'production' }` | Resolve strictly from `activeVersionId`; no latest fallback. |
| `{ label: 'latest' }` | Resolve the canonical newest version; it may be a draft. |
| `{ label: '<custom>' }` | Require custom-label capability, load the pointer, then load and verify its exact target. |
| `{ status }` or no selector | Preserve existing compatibility behavior. |

Reserved `production` and `latest` continue to work on adapters without custom-label persistence.

## Runtime pinning

Every new run follows the same boundary:

1. Parse and validate the selector.
2. Resolve it to an exact version ID.
3. Hydrate the root agent from that exact version.
4. Record the requested label, if any, separately from the resolved identity.
5. Persist the exact-version pin before the run can suspend or become recoverable.
6. Start behavior and tracing.

After step 5, runtime code passes version IDs, not labels.

Persist at least:

```ts
type ResolvedAgentVersionSelection = {
  agentId: string;
  versionId: string;
  selectedLabel?: string;
};
```

Continuation rules:

- suspend/resume, approvals, retries, and durable recovery read the persisted pin;
- an in-flight run is unaffected by later label movement;
- a continuation cannot replace its pinned version with a label or status;
- the same explicit version ID may be accepted idempotently;
- a different version ID returns `PINNED_VERSION_CONFLICT`;
- legacy durable runs without pins may be recovered only with an explicit exact version ID.

Explicit sub-agent label selectors may be resolved and pinned. The root label itself never becomes a graph-wide default.

## API and SDK surface

### Management routes

```http
GET    /stored/agents/:agentId/labels?page=0&perPage=50
PUT    /stored/agents/:agentId/labels/:label
DELETE /stored/agents/:agentId/labels/:label?expectedRevisionToken=<token>
POST   /stored/agents/:agentId/versions/:versionId/activate
```

Set-label body:

```ts
{
  versionId: string;
  expectedRevisionToken: string | null;
}
```

Activation gains an optional production precondition while preserving existing unconditional callers:

```ts
{
  expectedActiveVersionId?: string | null;
}
```

Version-list responses gain `labels: string[]`. Resolved details gain:

```ts
{
  resolvedVersionId?: string;
  selectedVersionLabel?: string;
}
```

The JavaScript client adds `listVersionLabels`, `setVersionLabel`, and `deleteVersionLabel`, and extends `activateVersion` with the optional precondition. An object-level selector such as `client.getAgent('support-agent', { label: 'pr-101' })` must apply to every new execution method, not only details.

### Public errors

The stable public vocabulary includes:

- `INVALID_VERSION_SELECTOR`;
- `INVALID_LABEL`;
- `RESERVED_LABEL`;
- `ENTITY_NOT_FOUND`;
- `VERSION_NOT_FOUND`;
- `LABEL_NOT_FOUND`;
- `LABEL_MOVE_CONFLICT`;
- `PINNED_VERSION_CONFLICT`;
- `VERSION_IN_USE_BY_LABEL`;
- `VERSION_LABEL_INTEGRITY_ERROR`;
- `VERSION_LABELS_UNSUPPORTED`.

Clients consume error codes and typed details, never English-message parsing.

Storage may keep its more explicit internal names, but server mapping is fixed: `INVALID_VERSION_LABEL` → `INVALID_LABEL`, `RESERVED_VERSION_LABEL` → `RESERVED_LABEL`, `VERSION_LABEL_NOT_FOUND` → `LABEL_NOT_FOUND`, and `VERSION_LABEL_CONFLICT` → `LABEL_MOVE_CONFLICT`.

## Capability and adapter support

Capability is advertised by entity type and operation, conceptually at:

```ts
storageCapabilities.versionLabels.entityTypes.agent = {
  read: true,
  write: true,
  compareAndSwap: true,
  retentionProtection: true,
};
```

Supported initially:

- InMemory;
- Filesystem;
- LibSQL, including Turso;
- PostgreSQL, including PostgreSQL VNext.

Capability-gated initially:

- source-controlled agents;
- MySQL;
- MongoDB;
- Aurora DSQL;
- Microsoft SQL Server;
- Oracle;
- Google Spanner.

Do not infer capability from adapter names, probe by attempting writes, or install a process-local fallback. A missing capability is unsupported. Custom-label operations return `VERSION_LABELS_UNSUPPORTED`; exact versioning, activation, and computed `production`/`latest` continue where existing plumbing supports them.

## Permissions

No new permission strings are introduced.

| Operation | Existing permission |
| --- | --- |
| List labels and version badges | `stored-agents:read` |
| Create, move, or delete a custom label | `stored-agents:publish` |
| Promote or roll back production | `stored-agents:publish` |
| Read resolved runtime details | `agents:read` |
| Execute by label | `agents:execute` |

The server remains authoritative and applies existing tenancy, ownership, and not-found masking rules.

## Public execution-path requirement

“Every public agent path” means every public handler whose behavior can depend on a hydrated agent version.

New-run or resolved-read coverage includes:

- runtime and stored-agent details;
- current, legacy, and vNext generate/stream routes;
- UI stream and network execution;
- agent-owned tool lookup/execution when tool attachment depends on the agent version;
- message, queue, signal, and stream-until-idle entry points;
- durable starts;
- experiments and evaluations;
- OpenAI-compatible Responses and A2A entry points when they select a Mastra agent.

Continuation coverage includes:

- resume and resume-until-idle;
- tool-call approval and decline;
- network approval and decline;
- suspended-run continuation;
- durable manual and automatic recovery;
- passive observation and subscription.

Before implementation, inventory handlers and classify each as resolved read, new execution, continuation, passive observation, or unrelated management. Tests must make bypasses visible. Continuations read pins; they do not accept a new mutable selector.

## Observability and evaluations

For a label-selected stored run:

- `entityVersionId` records the immutable version that executed;
- `selectedVersionLabel` records the label requested at run start;
- both survive suspension, resume, and durable recovery;
- label movement or deletion never rewrites historical traces;
- evaluation provenance stores agent ID, requested label, and resolved immutable version;
- an evaluation pins one resolution across all items and later reruns belonging to that evaluation.

This does not claim full context reproducibility. Prompt-block, skill, tool, schema, dynamic-content, and assembled-context provenance remain backlog work.

## Studio contract

The complete initial UX includes:

- `production`, custom, and `latest` badges in version history;
- custom-label create, move, and delete;
- production promotion and rollback through activation;
- read-only `latest`;
- label selection in the playground and evaluation flows;
- display of both selected label and resolved version;
- stale-state conflict review without blind retry;
- capability and permission gating;
- loading, empty, validation, authorization, unsupported, conflict, and server-error states;
- keyboard accessibility and mobile, tablet, and desktop behavior.

Studio preserves selector identity. Selecting `pr-101` sends `{ label: 'pr-101' }`; the browser must not silently replace it with the label's currently observed version ID before the request. Once execution resolves, the UI shows the runtime-authoritative pair, for example `pr-101 · v12`.

## Recommended implementation order

The PRD dependency order is storage → API/runtime → Studio. The practical build should use a thin vertical slice rather than finishing every adapter before exercising the API.

### 0. Freeze the cross-layer contract

- Confirm shared pointer and selector types.
- Confirm label validation, reserved names, public errors, capability shape, and CAS semantics.
- Add type-parity tests where storage-internal and public selector types cannot be literal aliases.

**Exit:** all layers can compile against one agreed contract.

### 1. Shared storage plus InMemory

- Add the optional generic label channel to `VersionedStorageDomain`.
- Add strict exact-version ownership and fail-closed behavior.
- Implement InMemory pointer lifecycle, CAS, retention, and conformance tests.
- Keep public labels disabled until integrated behavior exists.

**Exit:** storage semantics are proven without migration complexity.

### 2. Headless InMemory vertical slice

- Add management routes, schemas, capability advertisement, and permission mapping.
- Add selector parsing and custom/reserved resolution.
- Add SDK methods and selector serialization.
- Prove create → select → execute → trace → move → execute again.

**Exit:** a headless caller can safely use a real custom label end to end.

### 3. Runtime coverage and pinning

- Complete the public route inventory.
- Route all new executions through the common resolver.
- Persist pins for suspend/resume, approvals, retry, and durable recovery.
- Add eval and trace provenance.
- Fix cache keying and invalidate pointer-dependent reads after movement.

**Exit:** no new-run path drops the selector and no continuation re-resolves a label.

### 4. Durable storage adapters

- Implement Filesystem with an adapter-owned registry, critical section, and atomic replacement.
- Implement LibSQL/Turso with normalized schema, indexes, migration, and transactions.
- Implement PostgreSQL/PostgreSQL VNext with normalized schema, indexes, migration, and transaction/locking semantics.
- Run the same conformance suite against every supported adapter.

**Exit:** all supported adapters have identical semantics and survive restart where applicable.

### 5. Studio UX

- Build against the stable typed client contract with Vitest and MSW.
- Add timeline badges and the label manager.
- Add production promote/rollback and custom-label conflict recovery.
- Carry the discriminated selector through playground and evaluation flows.
- Complete accessibility, responsive, and narrow browser-only coverage.

**Exit:** a non-engineering operator can test a candidate label, evaluate it, promote it, and roll back production without copying IDs.

### 6. Pilot and release

- Dogfood on supported persistent storage.
- Pilot candidate labels before enabling production movement.
- Rehearse two-browser conflicts, production rollback, and trace history.
- Keep unsupported adapters explicitly gated.

**Exit:** both design-partner workflows complete without custom label plumbing outside Mastra.

## Likely code surfaces

Verify current source and package-local instructions before editing; these are navigation hints, not a substitute for repository search.

- Shared storage: `packages/core/src/storage/domains/versioned.ts`
- Agent storage contract and local adapters: `packages/core/src/storage/domains/agents/`
- Filesystem primitives: `packages/core/src/storage/filesystem-versioned.ts` and nearby storage files
- LibSQL agent domain: `stores/libsql/src/storage/domains/agents/`
- PostgreSQL agent domain: `stores/pg/src/storage/domains/agents/`
- Server handlers, schemas, and routes: `packages/server/src/server/handlers/`, `schemas/`, and `server-adapter/routes/`
- JavaScript client: `client-sdks/client-js/src/resources/agent.ts` and `stored-agent.ts`
- Studio agent hooks and version UI: `packages/playground/src/domains/agents/`
- Playground and evaluation entry points: `packages/playground/src/pages/agents/`

Observability, durable execution, agent-controller, network, Responses, and A2A code must be found through the route audit rather than assumed to live behind one handler.

## Test framework

### Storage conformance

Run one behavioral suite against every supported adapter. It must cover:

- create, list, resolve, move, and delete;
- several labels on one version and labels across versions;
- validation and reserved names;
- target ownership and scope isolation;
- CAS conflicts, idempotency, and delete/recreate ABA protection;
- atomic movement and concurrent deletion;
- retention and manual deletion protection;
- parent deletion cleanup;
- pagination and batched version-to-label lookup;
- restart persistence for Filesystem and databases;
- stable unsupported capability behavior.

### API and runtime

- strict exact-version and label resolution;
- management endpoints and production activation CAS;
- public error mapping and permissions;
- query/body disagreement;
- every route family with label, version ID, status, default, missing label, and foreign version where applicable;
- suspend/resume, approvals, recovery, retries, and pin conflicts;
- SDK query/body serialization and backward-compatible activation;
- trace and evaluation provenance after label movement.

### Studio

Use Vitest + MSW + typed client fixtures as the primary approach. Do not mock Mastra data hooks or services. Cover:

- capability, permission, loading, empty, and error states;
- badges and overflow;
- create, move, delete, promote, rollback, and conflicts;
- selector serialization and resolved-version display;
- cache invalidation across affected surfaces;
- historical evaluation identity after a label moves;
- keyboard operation and responsive layouts.

Use Playwright only for behavior MSW cannot reliably model, such as real focus trapping, viewport behavior, or a cross-page trace journey.

## Common implementation mistakes to prevent

- Persisting `production` or `latest` as custom-label rows.
- Using a mutable version ID such as `production` instead of a real pointer record.
- Falling back when an explicit version or label is missing.
- Fetching an exact version without verifying that it belongs to the requested agent.
- Resolving a label again after execution starts.
- Letting label movement alter suspended or durable runs.
- Propagating the root label to dependencies.
- Caching a label as immutable configuration.
- Allowing last-write-wins label movement.
- Deleting or pruning a custom-labeled version.
- Inferring adapter support from its class name.
- Adding a temporary metadata or process-memory representation on unsupported adapters.
- Letting Studio convert a label selection into an exact-version request before execution.
- Treating selected label as the canonical trace identity.
- Claiming the root agent version represents the full model-visible context.

## Explicitly deferred

Do not widen the first implementation to include:

- source-controlled agent labels;
- MySQL, MongoDB, Aurora DSQL, SQL Server, Oracle, or Spanner persistence;
- prompt-block, skill, or scorer public label APIs and UX;
- entity tags or tag-driven skill selection;
- model-configuration editing;
- tool versioning;
- complete dependency or assembled-context provenance;
- label movement audit history or protected-label approval policies;
- historical replay guarantees;
- Langfuse import tooling;
- label-specific permissions;
- custom-label rename.

Use the [expansion backlog](./agent-version-labels-backlog-prd.md) to extract later delivery PRDs rather than adding these to the initial checkpoint opportunistically.

## Implementation progress ledger

Keep this lightweight ledger current as work lands. A checked box means the corresponding PRD exit criteria and required tests pass, not merely that code exists.

- [x] Cross-layer types, validation, errors, and capability contract agreed
- [x] Strict exact-version ownership and fail-closed behavior shipped
- [x] InMemory label channel and conformance suite passing
- [x] Headless management and execution vertical slice passing
- [x] JavaScript client selector and management methods complete
- [ ] Public route audit complete
- [ ] Suspend/resume and durable pinning complete
- [ ] Trace and evaluation provenance complete
- [x] Filesystem conformance passing
- [x] LibSQL/Turso migration and conformance passing
- [x] PostgreSQL/PostgreSQL VNext migration and conformance passing
- [ ] Studio management, playground, and evaluation UX complete
- [ ] Accessibility and responsive verification complete
- [ ] Design-partner pilot and production rollback rehearsal complete

Step 2 evidence (2026-08-30): focused InMemory integration covers custom-label creation, stored-agent selection,
execution, conditional movement, and execution against the new target. Server tests cover stable public errors,
capability advertisement, and existing read/publish permissions. The JavaScript client build, lint, focused tests,
and full unit suite pass with generated route-contract parity. Runtime coverage beyond this vertical slice, durable
pinning, trace/evaluation provenance, and Studio remain unchecked above.

## Golden end-to-end scenario

Use this scenario as the cross-layer acceptance test:

1. An agent has immutable versions v10, v11, and v12; v10 is active.
2. Version history reports `production` on v10 and `latest` on v12.
3. Create `pr-101` on v12 with the expected-absent CAS precondition.
4. Resolve details and run generate, stream, and an evaluation using `{ label: 'pr-101' }`.
5. Each execution records `pr-101` plus v12's immutable version ID.
6. Suspend a labeled run, then move `pr-101` to v11.
7. The suspended run resumes on v12; a new `pr-101` run starts on v11.
8. A stale concurrent move receives `LABEL_MOVE_CONFLICT` and changes nothing.
9. Activate v12 using the observed v10 production precondition, then roll production back by activating v10.
10. Historical runs still identify their original immutable versions after both pointers move.
11. Delete `pr-101`; v11 remains, while the label disappears from future selectors.
12. Repeat the storage semantics on every supported adapter and verify an unsupported adapter advertises no custom-label capability.

## Working rules for implementation agents

1. Read [the repository instructions](../AGENTS.md) and the most specific package `AGENTS.md` before changing a package.
2. Verify current types, handlers, and route signatures in the repository; do not implement from this summary alone if source has changed.
3. Do not inspect or modify examples or reference material unless the task explicitly requires it.
4. Keep changes narrow and preserve unrelated work in a dirty worktree.
5. Start with colocated unit/integration tests and the narrowest package build, lint, and typecheck.
6. Use the primary MSW approach for Playground work and secondary Studio E2E only where necessary.
7. Update relevant public documentation when the feature ships.
8. Follow the repository changeset instructions after code changes.
9. If implementation reveals that a fixed decision must change, stop, explain the conflict, and update the relevant PRD before proceeding.

## Initial implementation is done when

- real custom labels work end to end for stored agents on every supported adapter;
- `production` remains only `activeVersionId` and `latest` remains computed;
- label movement is atomic, conditional, retention-safe, and scope-safe;
- every new public agent run can select a label and pins the exact resolved version;
- every continuation uses its persisted pin;
- traces and evaluations retain selected label plus immutable version identity;
- the JavaScript client propagates selectors through every applicable method;
- Studio supports the complete candidate → evaluation → production → rollback workflow;
- unsupported adapters remain truthfully capability-gated;
- existing callers using no selector, status, exact version IDs, or body-less activation continue to work;
- deferred domains remain deferred.
