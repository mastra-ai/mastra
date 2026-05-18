# Composio Integration — Phased Plan

This directory breaks the [parent RFC](../composio-research.md) into independently-mergeable, independently-verifiable phases. Read the parent RFC first for full context, locked-in decisions, and cross-cutting rules (config shape, storage model, three-mode auth, RBAC reservations).

## Phases

| Phase | Doc | Resource / Area | Units touched | Depends on |
|-------|-----|-----------------|---------------|------------|
| 1 | [phase-1-config.md](./phase-1-config.md) | Module skeleton + registry config | Types, validation, lazy SDK init | — |
| 2 | [phase-2-catalog.md](./phase-2-catalog.md) | Catalog API (read-only) | Server routes, allowlist filter | Phase 1 |
| 3 | [phase-3-connections.md](./phase-3-connections.md) | Storage + Connect Link lifecycle | DB schema, connection API | Phase 2 |
| 4 | [phase-4-builder-ui.md](./phase-4-builder-ui.md) | Builder UI — pick toolkits/tools | Playground components, hooks | Phase 3 |
| 5 | [phase-5-runtime.md](./phase-5-runtime.md) | Runtime tool execution | `resolveComposioUserId`, session per run | Phase 4 |
| 6 | [phase-6-ops.md](./phase-6-ops.md) | Observability + admin polish | Infrastructure status, error UX, docs | Phase 5 |
| 7 | [phase-7-auth-modes.md](./phase-7-auth-modes.md) | Per-binding auth modes (`platform` / `author` / `invoker`) | Storage, runtime, builder UI, runner UX | Phase 6 |

## How to work a phase

1. Open the phase doc.
2. Read **Background**, **Scope**, and the parent RFC sections it references.
3. Implement against **Scope**.
4. Check every box in **Acceptance truths**.
5. Run the **Verification step** commands — all green.
6. Follow **Handoff to next phase** when opening the next phase's PR.

A phase is **done** only when acceptance truths are all checked AND verification is clean. Do not start the next phase before then.

## Implementation strategy: build-first, slice-later

**Do not open PRs incrementally from scratch.** Build the full feature on a single integration branch first, prove it works end-to-end, then slice into the 6 stacked PRs.

```
main
 └── feat/composio-integration       ← build everything here, smoke-test, prove it works
      ├── feat/composio-1-config     ← sliced from integration branch
      ├── feat/composio-2-catalog
      ├── feat/composio-3-connections
      ├── feat/composio-4-builder-ui
      ├── feat/composio-5-runtime
      └── feat/composio-6-ops
```

### Steps

1. **Build on `feat/composio-integration`**
   - Implement all 6 phases in order locally.
   - Commit per phase boundary. Prefix commits with `phase-N:` for mechanical slicing.
   - Run the full verification suite end-to-end (real Composio sandbox or recorded fixtures).
   - Smoke-test in Studio via the `mastra-smoke-test` skill — build an agent, connect Gmail, run it.
   - Only proceed once the whole thing demonstrably works.

2. **Tag the proven state**
   - `git tag composio-integration-verified`
   - This is the rollback / reference point.

3. **Slice into stacked PRs**
   - `git checkout -b feat/composio-1-config main && git cherry-pick <phase-1 commits>`
   - For each subsequent phase: branch from the previous phase branch and cherry-pick that phase's commits.
   - Push and open PRs with `gh pr create --base feat/composio-N-…`.

4. **Verify each sliced PR independently**
   - Each phase branch must pass the **Verification step** in its phase doc, in isolation.
   - This catches "phase N accidentally depends on phase N+2" coupling leaks.
   - If a slice fails: go back to integration branch, find the missing piece, move it into the correct phase commit, re-slice.

5. **Merge in order**
   - PR 1 → main → rebase PR 2 → merge → etc.
   - Keep `feat/composio-integration` alive until PR 6 merges as a safety net.

### Why this works

- **Risk surfaces early** — discover schema/type coupling between phases before opening any PR.
- **Acceptance truths get a real test** — each phase doc was written assuming "the whole thing works"; the integration branch validates that.
- **Reviewer experience stays clean** — PRs remain small and focused.
- **No premature merges** — nothing lands in main until you know it all fits together.

### Coupling pitfalls to watch for during slicing

- **Phase 1 type leaks**: if Phase 1 needs to *export* a type that Phase 3 fills in, ship a placeholder type in Phase 1 — do not back-import from Phase 3's surface.
- **Schema-before-writers**: Phase 3 extends `integrationTools.composio` with `connectionsByToolkit` and adds the same field to `ResolveToolProviderToolsOptions`. Confirm Phase 4 code does not write through that path until Phase 3 has shipped it. (No `ComposioConnection` DB table in v1 — Composio is the source of truth.)
- **Resolver duplication**: `resolveComposioUserId` is introduced in Phase 3, consumed in Phase 5. If you find it referenced anywhere else during slicing, that is a leak.
- **`getComposioClient` provider wiring**: Phase 5 depends on the `MastraProvider` being passed in Phase 1. If you forgot it in Phase 1, fix Phase 1 commit, not Phase 5.

### Slicing log

Maintain `notes/composio-research/slicing-log.md` listing which integration-branch commits went into which phase branch. Auditable, and useful if a phase needs re-slicing.

---

## Stack structure

```
main
 └── feat/composio-1-config        ← Phase 1
      └── feat/composio-2-catalog  ← Phase 2 (rebased on 1)
           └── feat/composio-3-connections
                └── feat/composio-4-builder-ui
                     └── feat/composio-5-runtime
                          └── feat/composio-6-ops
```

Each PR uses `gh pr create --base feat/composio-N-…` for the parent branch. Phase N cannot merge until Phase N-1 lands.

## Shared verification commands

- `pnpm --filter @mastra/core build && pnpm --filter @mastra/core test`
- `pnpm --filter @mastra/editor build && pnpm --filter @mastra/editor test`
- `pnpm --filter @mastra/server build && pnpm --filter @mastra/server test`
- `pnpm --filter @mastra/playground-ui build && pnpm --filter @mastra/playground-ui test`
- `pnpm --filter @mastra/playground test:e2e` (for UI phases)
- `pnpm tsc --noEmit` (per touched package)

## Out of scope (whole RFC)

- **Custom auth configs** — v1 uses Composio-managed credentials only.
- **Composio triggers / event subscriptions** — feature not exposed in v1.
- **MCP integration path** (`session.mcp.url`) — researched, deferred. Direct tool registration only.
- **vNext `user` and `per-author` auth modes** — only `platform` mode ships. Schema reserves the enum.
- **Connection-level RBAC** — schema reserves `allowedRoles?` field, no enforcement in v1.
- **Cross-workspace connection sharing** — connections are workspace-scoped.
- **Admin UI for registry config** — config lives in code (`editor.builder.registries.composio`).
- **Author-side custom Connect Link redirect URLs** — Studio handles the callback.
