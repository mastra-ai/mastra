# PR #17541: fix: sync task state to V1 session in HarnessCompat

Source: https://github.com/mastra-ai/mastra/pull/17541

Order: 34 of 34

Status: OPEN; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `main` -> `devin/1780517871-fix-task-state-divergence`

Diff size: +52 / -1; 3 changed files.

## Before

Task state in `MastraCodeState.tasks` could diverge from v1 session state.

## What changed

Synced task state to V1 session in `HarnessCompat`.

## Why this is suspicious

- Confirms task state split-brain was real.
- If tasks require special sync, other state fields may still be divergent.
- Prompt-injected current task list, TUI TaskProgress, and task tools can disagree.

## Feature surfaces to retest

- task_write/update/complete/check sequence.
- Thread switch after task update.
- Prompt injection contains latest task list.
- Subagent/task tools do not leak tasks across threads.

## Commit headlines

- `f31fbe60a4` fix: sync task state to V1 session in HarnessCompat

## Changed files

- `mastracode/src/HarnessCompat.test.ts` (+27 / -0)
- `mastracode/src/HarnessCompat.ts` (+24 / -0)
- `packages/core/src/harness/harness.ts` (+1 / -1)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
