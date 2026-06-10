# PR #16902: feat(core): add Harness v1 goals

Source: https://github.com/mastra-ai/mastra/pull/16902

Order: 20 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-display-state` -> `feat/harness-v1-goals`

Diff size: +409 / -0; 3 changed files.

## Before

Mastra Code implemented goal mode in TUI `GoalManager` and persisted it in thread metadata.

## What changed

Added Harness v1 goals.

## Why this is suspicious

- Two goal systems can conflict: core v1 goals and Mastra Code TUI goals.
- Thread metadata persistence must remain compatible.
- Judge loop continuation/waiting/done semantics are product-specific.

## Feature surfaces to retest

- /goal start/status/pause/resume/clear.
- Goal persistence across thread switch/restart.
- Judge failure resume retrigger behavior.

## Commit headlines

- `7b977f8ab6` feat(core): add Harness v1 goals

## Changed files

- `.changeset/tangy-pillows-jam.md` (+5 / -0)
- `packages/core/src/harness/v1/session.goal.test.ts` (+240 / -0)
- `packages/core/src/harness/v1/session.ts` (+164 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
