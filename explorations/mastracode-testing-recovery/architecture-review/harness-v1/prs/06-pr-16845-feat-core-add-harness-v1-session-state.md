# PR #16845: feat(core): add Harness v1 session state

Source: https://github.com/mastra-ai/mastra/pull/16845

Order: 6 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-registry` -> `feat/harness-v1-session-state`

Diff size: +533 / -3; 4 changed files.

## Before

Legacy harness state was a single mutable `MastraCodeState` object accessed through `harness.getState()` / `setState()`.

## What changed

Added v1 session state. This is the first direct alternative owner for state values.

## Why this is suspicious

- This is a critical split-brain point: Mastra Code state can now exist in both legacy-compatible harness state and v1 session state.
- Fields like modelId/modeId/tasks/yolo/permissions may drift unless every setter is bridged.
- Later fixes for model preservation, subagent model state, and task state divergence strongly indicate regressions here.

## Feature surfaces to retest

- Mutate every MastraCodeState field via TUI commands and verify dynamic agent context sees it.
- Switch thread and verify model/mode/task state remains expected.
- Run headless with state overrides.

## Commit headlines

- `fed2453107` feat(core): add harness v1 session state

## Changed files

- `.changeset/solid-news-open.md` (+5 / -0)
- `packages/core/src/harness/v1/session.mode-state.test.ts` (+164 / -0)
- `packages/core/src/harness/v1/session.models.test.ts` (+201 / -0)
- `packages/core/src/harness/v1/session.ts` (+163 / -3)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
