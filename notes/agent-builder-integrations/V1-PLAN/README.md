# Agent Builder Integrations — Phased Plan

This directory breaks the [parent plan](../V1-PLAN.md) into independently-mergeable, independently-verifiable phases. Read the parent plan first for ground rules and the cross-phase verification matrix, and [ARCHITECTURE.md](../ARCHITECTURE.md) for the canonical spec.

## Phases

| Phase | Doc | Resource / Area | Units touched | Depends on |
|-------|-----|-----------------|---------------|------------|
| 1 | [phase-1-provider-interface.md](./phase-1-provider-interface.md) | Core types + storage + server schemas | 5 | — |
| 2 | [phase-2-base-provider-registry.md](./phase-2-base-provider-registry.md) | `BaseIntegrationProvider` + typed registry | 3 | Phase 1 |
| 3 | [phase-3-composio-adapter.md](./phase-3-composio-adapter.md) | `ComposioToolProvider` rewrite | 2 | Phase 2 |
| 4 | [phase-4-runtime-fanout.md](./phase-4-runtime-fanout.md) | `resolveStoredIntegrationTools` + suffix logic | 2 | Phase 3 |
| 5 | [phase-5-server-routes.md](./phase-5-server-routes.md) | `/api/tool-providers/*` + typed client | 8 | Phase 3 |
| 6 | [phase-6-ui-tools-panel.md](./phase-6-ui-tools-panel.md) | Tools panel + connection picker | 6 | Phase 5 |
| 7 | [phase-7-form-mappers.md](./phase-7-form-mappers.md) | Form schema + save/load mappers | 3 | Phase 6 |
| 8 | [phase-8-agent-builder-tool.md](./phase-8-agent-builder-tool.md) | `agentBuilderTool` LLM-facing schema | 2 | Phase 7 |
| 9 | [phase-9-health-pill.md](./phase-9-health-pill.md) | Per-agent health pill | 3 | Phase 5, 6 |
| 10 | [phase-10-cleanup.md](./phase-10-cleanup.md) | Delete prototype dead code | many | All previous |
| 11 | [phase-11-docs-changeset.md](./phase-11-docs-changeset.md) | Public docs + changeset | 2 | Phase 10 |

## How to work a phase

1. Open the phase doc.
2. Read **Background**, **Scope**, and the parent / ARCHITECTURE sections it references.
3. Implement against **Scope**.
4. Check every box in **Acceptance truths**.
5. Run the **Verification step** commands — all green.
6. Follow **Handoff to next phase** when opening the next phase's PR.

A phase is **done** only when acceptance truths are all checked AND verification is clean. Do not start the next phase before then.

## Shared verification commands

- `pnpm --filter ./packages/core build`
- `pnpm --filter ./packages/server build`
- `pnpm --filter ./packages/editor build`
- `pnpm --filter ./packages/playground build`
- `pnpm --filter ./packages/core test`
- `pnpm --filter ./packages/editor test composio`
- `pnpm --filter ./packages/server test tool-providers`
- `pnpm --filter ./packages/playground test mappers`
- `pnpm --filter ./packages/playground test health-pill`

## Out of scope (deferred)

- Invoker mode (`kind: 'invoker'`) — v1.5
- Mid-chat Connect badge + auto-retry — v1.5
- Memory `resourceId` per-mode switch — v1.5
- Platform mode (`kind: 'platform'`) — v2
- Per-tool overrides (key change `toolService` → `toolSlug`) — v2
- Reserved labels (`INVOKER`, `PLATFORM`) — revisit when those modes land
- Additional adapters (e.g. Arcade) — v1.5+
- White-label / custom OAuth apps — v1.5
