# PR #16817: chore(core): rename legacy harness class

Source: https://github.com/mastra-ai/mastra/pull/16817

Order: 1 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `main` -> `chore/harness-legacy-rename`

Diff size: +94 / -79; 21 changed files.

## Before

The legacy harness class was named and exported as the primary `Harness` surface. There was not yet a parallel v1 subpath or new runtime stack. Mastra Code imported `Harness` directly from `@mastra/core/harness` and all downstream TUI/headless code expected that one legacy contract.

## What changed

Renamed the legacy harness class internally to make room for a new Harness v1 API without immediately breaking existing imports. This was preparatory but touched core harness files and tests.

## Why this is suspicious

- Even rename-only PRs can break type exports, declaration generation, or runtime imports.
- Any accidental public export rename would break Mastra Code because it still imported the legacy harness directly.
- This establishes the first dual-harness period, which is a long-term compatibility hazard.

## Feature surfaces to retest

- Mastra Code startup imports `@mastra/core/harness` without ESM/CJS export failures.
- Legacy harness tests still exercise the same public APIs.
- Declaration-only bundles preserve old import paths.

## Commit headlines

- `cccd21436a` chore(core): rename legacy harness class
- `0e3014aa22` feat(core): add harness v1 subpath scaffold (#16818)
- `f89d1f74f0` chore(core): keep harness legacy rename scoped

## Changed files

- `.changeset/rare-rats-wish.md` (+9 / -0)
- `packages/core/src/harness/__tests__/harness-tool-suspension.test.ts` (+5 / -5)
- `packages/core/src/harness/clone-thread.test.ts` (+3 / -3)
- `packages/core/src/harness/display-state.test.ts` (+18 / -18)
- `packages/core/src/harness/fork-clone-metadata.test.ts` (+3 / -3)
- `packages/core/src/harness/get-om-record.test.ts` (+2 / -2)
- `packages/core/src/harness/harness.ts` (+2 / -2)
- `packages/core/src/harness/index.ts` (+7 / -1)
- `packages/core/src/harness/list-threads-fork-filter.test.ts` (+3 / -3)
- `packages/core/src/harness/mode-model-persistence.test.ts` (+3 / -3)
- `packages/core/src/harness/om-failure-abort.test.ts` (+2 / -2)
- `packages/core/src/harness/om-threshold-persistence.test.ts` (+2 / -2)
- `packages/core/src/harness/resource-id.test.ts` (+3 / -3)
- `packages/core/src/harness/signal-history.test.ts` (+2 / -2)
- `packages/core/src/harness/signal-messages.test.ts` (+3 / -3)
- `packages/core/src/harness/switch-model.test.ts` (+2 / -2)
- `packages/core/src/harness/task-tools.test.ts` (+4 / -4)
- `packages/core/src/harness/thread-locking.test.ts` (+5 / -5)
- `packages/core/src/harness/token-usage.test.ts` (+3 / -3)
- `packages/core/src/harness/tracing-propagation.test.ts` (+3 / -3)
- `packages/core/src/harness/workspace-resolution.test.ts` (+10 / -10)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
