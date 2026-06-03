# PR #16881: feat(core): add Harness v1 event id helpers

Source: https://github.com/mastra-ai/mastra/pull/16881

Order: 10 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-agent-run-output` -> `feat/harness-v1-event-id-helpers`

Diff size: +242 / -4; 6 changed files.

## Before

Event IDs were either legacy harness implementation details or ad hoc event payload fields.

## What changed

Added Harness v1 event ID helpers.

## Why this is suspicious

- Event identity affects dedupe, ordering, replay, and UI component updates.
- If IDs are regenerated during projection, TUI can duplicate or fail to update components.
- Replay/observability can link the wrong event to tool state.

## Feature surfaces to retest

- Tool start/update/end component reconciliation.
- Message delta ordering.
- Replay or persisted event hydration.

## Commit headlines

- `01e78c7705` feat(core): add Harness v1 event id helpers

## Changed files

- `.changeset/fruity-mirrors-matter.md` (+5 / -0)
- `packages/core/src/harness/v1/events.test.ts` (+70 / -0)
- `packages/core/src/harness/v1/events.ts` (+118 / -4)
- `packages/core/src/harness/v1/export-map.test.ts` (+43 / -0)
- `packages/core/src/harness/v1/index.ts` (+4 / -0)
- `packages/core/src/storage/domains/harness/types.ts` (+2 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
