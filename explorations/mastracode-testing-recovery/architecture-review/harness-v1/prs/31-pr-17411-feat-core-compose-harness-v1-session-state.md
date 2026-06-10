# PR #17411: feat(core): compose Harness v1 session state

Source: https://github.com/mastra-ai/mastra/pull/17411

Order: 31 of 34

Status: Merged at 2026-06-03T11:54:43Z

Stack edge: `main` -> `wardpeet/harness-workspace`

Diff size: +1517 / -85; 20 changed files.

## Before

`HarnessCompat` still delegated or composed state incompletely; v1 session state and legacy state could diverge.

## What changed

Composed Harness v1 session state into the compatibility surface and added state/workspace handling.

## Why this is suspicious

- This is a direct split-brain fix and therefore very suspicious: it changes what `getState()` returns and where `setState()` writes.
- Composed state can hide stale underlying owners.
- Later fixes for subagent model state, model preservation, and task state show composition was incomplete.

## Feature surfaces to retest

- Every command that calls `setState()` then run dynamic tools/instructions.
- Thread switch preserves current model.
- Task tools mutate rendered state and prompt-injected task list.
- Workspace updates after sandbox access.

## Commit headlines

- `d538bed37d` feat(core): add state and workspace to harness v1
- `27dc9353d8` chore: remove harness v1 changesets
- `54a2ccf3b2` feat(core): compose session state in harness compat
- `6be410ad92` fix(core): keep subagent model state in harness compat
- `bd7c44a961` chore: remove harness compat changesets
- `5b9c9445c8` refactor(core): move state ownership from Harness v1 to Session
- `60c0f82d2c` refactor(core): simplify v1 session workspace to single DynamicArgument
- `3df4a449e6` fix(mastracode): preserve model when switching threads
- `8f1f263418` fix(mastracode): read composed harness state defensively
- `bdc92b4867` feat(core): add v1 harness tools and canonical skills
- `2a0e7329fb` fix(mastracode): keep v0 subagents out of harness v1
- `12b8620d6b` update requestContext
- `7ad4e5df49` Merge branch 'main' into wardpeet/harness-workspace
- `d89bc28281` test(core): remove stale harness workspace context expectation

## Changed files

- `mastracode/src/HarnessCompat.test.ts` (+187 / -0)
- `mastracode/src/HarnessCompat.ts` (+86 / -13)
- `mastracode/src/agents/instructions.ts` (+3 / -3)
- `mastracode/src/agents/tools.ts` (+3 / -3)
- `mastracode/src/index.ts` (+23 / -17)
- `mastracode/src/schema.ts` (+9 / -5)
- `packages/core/src/harness/v1/events.ts` (+20 / -2)
- `packages/core/src/harness/v1/harness.state-workspace.test.ts` (+132 / -0)
- `packages/core/src/harness/v1/harness.tools.test.ts` (+113 / -0)
- `packages/core/src/harness/v1/harness.ts` (+134 / -7)
- `packages/core/src/harness/v1/harness.types.ts` (+71 / -8)
- `packages/core/src/harness/v1/index.ts` (+6 / -0)
- `packages/core/src/harness/v1/permissions.types.ts` (+12 / -0)
- `packages/core/src/harness/v1/session.ts` (+256 / -26)
- `packages/core/src/harness/v1/session.types.ts` (+19 / -1)
- `packages/core/src/harness/v1/skills.test.ts` (+226 / -0)
- `packages/core/src/harness/v1/skills.types.ts` (+19 / -0)
- `packages/core/src/harness/v1/subagents.types.ts` (+73 / -0)
- `packages/core/src/harness/v1/tools.test.ts` (+56 / -0)
- `packages/core/src/harness/v1/tools.ts` (+69 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
