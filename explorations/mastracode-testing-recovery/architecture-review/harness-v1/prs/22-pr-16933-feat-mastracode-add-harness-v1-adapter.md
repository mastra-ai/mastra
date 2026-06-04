# PR #16933: feat(mastracode): add Harness v1 adapter

Source: https://github.com/mastra-ai/mastra/pull/16933

Order: 22 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-complete-core` -> `feature/pf-565-harness-v1-mastracode`

Diff size: +3212 / -85; 31 changed files.

## Before

Mastra Code imported and returned legacy `Harness` directly. There was no Mastra Code `HarnessCompat` adapter.

## What changed

Added the first Mastra Code Harness v1 adapter/compatibility layer and updated Mastra Code integration/tests around it.

## Why this is suspicious

- This is the first product-facing bridge. It likely had incomplete parity for state, events, suspensions, subagents, and headless behavior.
- A compatibility layer can make broken behavior look superficially correct by preserving method names.
- Every Mastra Code feature now depends on adapter projection fidelity.

## Feature surfaces to retest

- Interactive startup and first message.
- Headless prompt with auto approvals.
- Thread creation/switch/clone.
- Tool approvals and sandbox access.
- Mode/model switching.

## Commit headlines

- `a3e64529b3` feat(mastracode): add Harness v1 adapter
- `7c6030a0e9` fix(mastracode): harden harness v1 compatibility
- `3d81d550cc` fix(core): preserve harness admission dedupe
- `09ffc473b0` fix(mastracode): harden headless mode preflight
- `8f93854b4b` refactor(mastracode): promote harness v1 runtime
- `580add656d` Merge parent harness v1 stack into mastracode
- `05f2e5f4d2` Merge remote-tracking branch 'origin/feat/harness-v1-complete-core' i…
- `837a32e502` Merge remote-tracking branch 'origin/feat/harness-v1-complete-core' i…

## Changed files

- `.changeset/icy-worms-mix.md` (+5 / -0)
- `.changeset/loud-buckets-brush.md` (+5 / -0)
- `mastracode/src/__tests__/index.test.ts` (+31 / -0)
- `mastracode/src/harness/events.ts` (+52 / -0)
- `mastracode/src/harness/index.ts` (+1 / -0)
- `mastracode/src/harness/legacy-compat.ts` (+10 / -0)
- `mastracode/src/harness/message-content.ts` (+52 / -0)
- `mastracode/src/harness/model-ids.ts` (+7 / -0)
- `mastracode/src/harness/runtime.test.ts` (+623 / -0)
- `mastracode/src/harness/runtime.ts` (+1578 / -0)
- `mastracode/src/harness/thread-conversion.ts` (+19 / -0)
- `mastracode/src/headless-integration.test.ts` (+120 / -3)
- `mastracode/src/headless.ts` (+36 / -22)
- `mastracode/src/index.test.ts` (+3 / -0)
- `mastracode/src/index.ts` (+1 / -1)
- `mastracode/src/tools/__tests__/request-sandbox-access.test.ts` (+53 / -0)
- `mastracode/src/tools/request-sandbox-access.ts` (+19 / -7)
- `mastracode/src/tui/__tests__/setup-keyboard-shortcuts.test.ts` (+1 / -0)
- `packages/core/src/agent/thread-stream-runtime.ts` (+8 / -8)
- `packages/core/src/agent/types.ts` (+2 / -0)
- `packages/core/src/harness/index.ts` (+2 / -1)
- `packages/core/src/harness/v1/errors.ts` (+1 / -1)
- `packages/core/src/harness/v1/index.ts` (+7 / -0)
- `packages/core/src/harness/v1/session.injectSystemReminder.test.ts` (+37 / -0)
- `packages/core/src/harness/v1/session.message.test.ts` (+13 / -2)
- `packages/core/src/harness/v1/session.signal-routing.test.ts` (+58 / -0)
- `packages/core/src/harness/v1/session.signal.test.ts` (+42 / -0)
- `packages/core/src/harness/v1/session.spawn-subagent.test.ts` (+24 / -0)
- `packages/core/src/harness/v1/session.test.ts` (+18 / -4)
- `packages/core/src/harness/v1/session.ts` (+351 / -34)
- `packages/core/src/harness/v1/types.ts` (+33 / -2)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
