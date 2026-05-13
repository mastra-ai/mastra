# Agent Builder Integrations — V1 Build Plan

**Status:** ordered build plan — Revision 2 (split into phase docs)
**Scope:** v1 (author mode only)
**Spec:** [ARCHITECTURE.md](./ARCHITECTURE.md)
**Phases:** [V1-PLAN/](./V1-PLAN/) — one doc per phase
**Approach:** clean rebuild on a fresh branch. The Composio prototype on this branch is **reference only** — no migration code.

---

## 0. Ground rules

- **Author mode only.** `kind: 'invoker'` and `kind: 'platform'` accepted by schema, never written by v1.
- **No migration.** Prototype-shape agents get a clear "please re-save" error. No normalizer code path.
- **Composio adapter only in v1.** The interface is provider-agnostic so additional adapters (e.g. Arcade) slot in later without changing the interface.
- **Tests are part of the step**, not a follow-up phase.
- **Each phase ends with a verifiable acceptance criterion.** Don't move on until it passes.
- **OSS / no-auth fallback:** `internalUserId = storedAgent.authorId ?? requestContext.currentUser?.id ?? 'default'` (per ARCHITECTURE §14).

---

## Phases

Each phase ships as its own PR. Open the linked doc for goal, scope, acceptance truths, and verification.

| Phase | Doc | Resource / Area | Depends on |
|-------|-----|-----------------|------------|
| 1 | [phase-1-provider-interface.md](./V1-PLAN/phase-1-provider-interface.md) | Core types + storage + server schemas | — |
| 2 | [phase-2-base-provider-registry.md](./V1-PLAN/phase-2-base-provider-registry.md) | `BaseIntegrationProvider` + typed registry | Phase 1 |
| 3 | [phase-3-composio-adapter.md](./V1-PLAN/phase-3-composio-adapter.md) | `ComposioToolProvider` rewrite | Phase 2 |
| 4 | [phase-4-runtime-fanout.md](./V1-PLAN/phase-4-runtime-fanout.md) | `resolveStoredIntegrationTools` + suffix logic | Phase 3 |
| 5 | [phase-5-server-routes.md](./V1-PLAN/phase-5-server-routes.md) | `/api/tool-providers/*` + typed client | Phase 3 |
| 6 | [phase-6-ui-tools-panel.md](./V1-PLAN/phase-6-ui-tools-panel.md) | Tools panel + connection picker | Phase 5 |
| 7 | [phase-7-form-mappers.md](./V1-PLAN/phase-7-form-mappers.md) | Form schema + save/load mappers | Phase 6 |
| 8 | [phase-8-agent-builder-tool.md](./V1-PLAN/phase-8-agent-builder-tool.md) | `agentBuilderTool` LLM-facing schema | Phase 7 |
| 9 | [phase-9-health-pill.md](./V1-PLAN/phase-9-health-pill.md) | Per-agent health pill | Phase 5, 6 |
| 10 | [phase-10-cleanup.md](./V1-PLAN/phase-10-cleanup.md) | Delete prototype dead code | All previous |
| 11 | [phase-11-docs-changeset.md](./V1-PLAN/phase-11-docs-changeset.md) | Public docs + changeset | Phase 10 |

See [V1-PLAN/README.md](./V1-PLAN/README.md) for the how-to-work-a-phase workflow.

---

## Cross-phase verification matrix

| Check                               | Phase | Command                                                         |
| ----------------------------------- | ----- | --------------------------------------------------------------- |
| Core builds                         | 1+    | `pnpm --filter ./packages/core build`                           |
| Server builds                       | 1+    | `pnpm --filter ./packages/server build`                         |
| Editor builds                       | 3+    | `pnpm --filter ./packages/editor build`                         |
| Playground builds                   | 6+    | `pnpm --filter ./packages/playground build`                     |
| Base provider tests                 | 2     | `pnpm --filter ./packages/core test base`                       |
| Composio adapter tests              | 3     | `pnpm --filter ./packages/editor test composio`                 |
| Runtime fan-out tests               | 4     | `pnpm --filter ./packages/core test runtime`                    |
| Route tests                         | 5     | `pnpm --filter ./packages/server test tool-providers`           |
| Mapper round-trip                   | 7     | `pnpm --filter ./packages/playground test mappers`              |
| Health pill                         | 9     | `pnpm --filter ./packages/playground test health-pill`          |
| No legacy references                | 10    | `grep -r 'connectionsByToolkit\|authMode\|ConnectionPin\|ConnectionBinding' .` |

---

## Manual smoke (end of phase 9)

1. Configure Composio in `examples/agent-builder/src/mastra/index.ts` (`allowedToolServices: ['gmail']`).
2. Create a new agent in the builder.
3. Add `gmail.fetch_emails` from Composio → empty-state row appears in Tools panel.
4. Authorize as "Work" → row marks "Connected", health pill turns `✓`.
5. Add a second connection "Personal" → tool fans out to `gmail.fetch_emails__WORK` + `gmail.fetch_emails__PERSONAL`.
6. Chat: "fetch my work emails" → agent picks `__WORK` variant; "fetch my personal emails" → `__PERSONAL`.
7. Revoke "Personal" at Composio dashboard → pill flips to `⚠`, popover names "Personal" as disconnected.
8. Click "Reauthorize" on "Personal" → same `connectionId`, fresh token, pill back to `✓`.

If every step works, v1 is shippable.

---

## Out of scope (deferred)

- Invoker mode (`kind: 'invoker'`) — v1.5
- Mid-chat Connect badge + auto-retry — v1.5
- Memory `resourceId` per-mode switch — v1.5
- Platform mode (`kind: 'platform'`) — v2
- Per-tool overrides (key change `toolService` → `toolSlug`) — v2
- Reserved labels (`INVOKER`, `PLATFORM`) — revisit when those modes land
- Additional adapters (e.g. Arcade) — v1.5+ (interface is provider-agnostic; adapter ports come later)
- White-label / custom OAuth apps — v1.5 (Composio `authConfigs`, `callbackUrl` on authorize, related capability flags)
