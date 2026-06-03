# PR #16896: feat(core): add Harness v1 session queue

Source: https://github.com/mastra-ai/mastra/pull/16896

Order: 15 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-session-signals` -> `feat/harness-v1-session-queue`

Diff size: +741 / -20; 5 changed files.

## Before

Legacy harness handled run/message queues and TUI had a manual follow-up queue.

## What changed

Added Harness v1 session queue.

## Why this is suspicious

- Two queues can reorder or duplicate messages.
- Ctrl+F/manual queued follow-ups and active-run signals have different semantics.
- Queue persistence can restart old messages unexpectedly.

## Feature surfaces to retest

- Enter during active run sends signal, Ctrl+F queues.
- Queued follow-up executes after run end once.
- Abort clears or preserves queue according to legacy behavior.

## Commit headlines

- `f07b3673d1` feat(core): add Harness v1 session queue

## Changed files

- `.changeset/tiny-apes-swim.md` (+5 / -0)
- `packages/core/src/harness/v1/errors.ts` (+13 / -0)
- `packages/core/src/harness/v1/session.queue.test.ts` (+284 / -0)
- `packages/core/src/harness/v1/session.ts` (+432 / -20)
- `packages/core/src/harness/v1/types.ts` (+7 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
