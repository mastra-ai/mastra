# Testing Strategy — Mastra Software Factory

## Test runner and layout

Vitest, configured in `vitest.config.ts` as a single project `unit:mastra-factory`, `environment: 'node'`, including `src/**/*.test.ts` and excluding `node_modules`/`dist`. Tests are colocated with source (`foo.ts` + `foo.test.ts`), following the repo-wide convention. Run scoped to this package:

```
pnpm --filter @mastra/factory test        # vitest run
pnpm --filter @mastra/factory check       # tsc --noEmit
pnpm --filter @mastra/factory lint        # oxlint . && eslint .
```

Prefer the narrowest `pnpm --filter` invocation; build workspace dependencies first on a fresh clone (`pnpm install` then build what this package depends on) since unresolved workspace imports usually mean a dependency needs building.

## What is unit-tested where

- **Board definitions** (`boards/*.test.ts`): `define-board.test.ts` exercises `defineBoard()`'s own validation (bad `kind`, missing `role` on a working phase, `role` present on terminal, non-resting `initialPhase`, reserved board ids). `transition-policy.test.ts` exercises the allow/reject decision matrix directly against a `BoardTransitionPolicyContext` fixture — no agent runtime involved (`work-transition-policy.ts` itself has no dedicated test file). `registry.test.ts` covers `createBoardRegistry()` merge/rejection of duplicate or reserved ids. `semantics.test.ts` covers `resolvePhaseSemantics`/`boardForWorkItem`.
- **Board test fixtures** (`boards/test-utils.ts`): `createLifecycleTestRegistry()` builds a Work-shaped board with injected `onEnter`/`onExit` handlers per stage — use this to test a lifecycle rule's decision in isolation without wiring the full dispatcher. `createToolRuleTestRegistry()` does the same for tool-result rules. `createTestBoard()` builds a minimal 3-phase custom board (`queued` → `shipping` → `shipped`) for exercising generic (non-Work/Review) board behavior.
- **Storage domains** (`storage/domains/*/*.test.ts`): each domain's CRUD, schema round-tripping (`toFoo`/DB row), and domain-specific invariants (e.g. `documents/base.test.ts`/`sync.test.ts`/`refresh.test.ts`/`manifest.test.ts` for catalog, sync, refresh, and missing/oversize manifest handling; `work-items/*.test.ts` for stage transitions and revision conflicts) against an in-memory or test storage backend.
- **`factory.test.ts`**: the top-level integration surface for `MastraFactory` itself — constructor validation, `prepare()` (route/tool assembly, integration channel wiring, audit-capable integration detection), and `finalize()`. Organized as `describe('MastraFactory constructor', ...)`, `describe('MastraFactory.prepare', ...)`, `describe('MastraFactory.prepare audit-capable integrations', ...)`, `describe('MastraFactory.prepare integrations', ...)`, `describe('MastraFactory.finalize', ...)`.
- **Dispatcher** (`rules/dispatcher.test.ts` and neighbors): lease/claim, retry/backoff on transient failure vs. terminal failure (`isTerminalFailure`), plan-approval loop capping (`MAX_PLAN_APPROVALS`), stale-binding sweep, and reconcile-on-missed-result paths — typically against a fake `AgentController`/`Session` rather than a real agent run.
- **Route contracts** (`routes/contracts.test.ts` if present, `routes/surface.test.ts`): schema shape assertions (path/query/body validate the intended inputs and reject malformed ones) and route assembly (`assembleFactoryApiRoutes`) wiring.
- **Integration modules** (`integrations/github/*.test.ts`, `integrations/linear/*.test.ts`): webhook signature/parsing, default event-rule behavior, sandbox provisioning, token refresh, reconciliation — each integration's test file matches its source file 1:1 (e.g. `webhook.ts`/`webhook.test.ts`, `rules.ts`/`rules.test.ts`).

## Conventions to follow when adding tests

- Build a board fixture with the existing `boards/test-utils.ts` helpers instead of hand-rolling a `BoardDefinition` — keeps fixtures aligned with `defineBoard()`'s real validation.
- Assert on the **typed decision shape** a rule handler returns (`{ type: 'allow', ... }` / `{ type: 'reject', code, reason }` / `invokeSkill(...)` / `undefined`) rather than on internal side effects, mirroring how `transition-policy.ts` and `define-board.ts` type these contracts.
- For dispatcher/timing-sensitive tests, use the package's existing fake-clock/fake-session patterns already present in `rules/*.test.ts` rather than real timers or a real agent run — this package's dispatcher has many named constants (`LEASE_MS`, `POLL_MS`, `MAX_ATTEMPTS`, etc.) precisely so tests can reason about bounded behavior deterministically.
- New storage domain methods get a same-file `*.test.ts` covering both the happy path and the domain's stated invariants (e.g. "a document the repo lacks is stored as `status: 'missing'`", "a redelivered ingress reuses the prior committed result").
- Schema/contract changes: add or update the Zod-schema-level test asserting both acceptance of valid shapes and rejection of invalid ones (this is where deterministic input constraints belong, per the project's schema-vs-execute convention).

## Beyond this package

- End-to-end/UI-facing behavior for the Factory board views lives in `factory-ui` and is covered by that package's own testing skill (Playwright/MSW) — not by anything in this package's Vitest suite.
- Cross-package integration tests that need real workspace builds may require `pnpm i --ignore-workspace`, per the root `AGENTS.md`.
