# PR #16901: feat(core): add Harness v1 display state

Source: https://github.com/mastra-ai/mastra/pull/16901

Order: 19 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-built-in-tools` -> `feat/harness-v1-display-state`

Diff size: +372 / -20; 5 changed files.

## Before

Mastra Code had TUI display state/components but no v1 display state abstraction.

## What changed

Added Harness v1 display state.

## Why this is suspicious

- Display state can duplicate TUI state and drift.
- Generic display events may not map to existing pi-tui components.
- Future compatibility code may treat display state as source-of-truth even though MastraTUI owns rendering.

## Feature surfaces to retest

- Tool progress rendering.
- OM progress rendering.
- Subagent display state.
- Resume thread and render existing UI state.

## Commit headlines

- `d5fc0c82f3` feat(core): add Harness v1 display state

## Changed files

- `.changeset/plain-geese-sniff.md` (+5 / -0)
- `packages/core/src/harness/v1/index.ts` (+4 / -0)
- `packages/core/src/harness/v1/session.display-state.test.ts` (+274 / -0)
- `packages/core/src/harness/v1/session.ts` (+49 / -5)
- `packages/core/src/harness/v1/types.ts` (+40 / -15)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
