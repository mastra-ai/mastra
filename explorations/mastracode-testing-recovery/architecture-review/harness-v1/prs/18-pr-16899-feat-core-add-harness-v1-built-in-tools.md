# PR #16899: feat(core): add Harness v1 built-in tools

Source: https://github.com/mastra-ai/mastra/pull/16899

Order: 18 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-session-suspensions` -> `feat/harness-v1-built-in-tools`

Diff size: +407 / -5; 7 changed files.

## Before

Mastra Code used workspace and custom dynamic tools with Mastra Code-specific names and hook wrappers.

## What changed

Added Harness v1 built-in tools.

## Why this is suspicious

- Canonical v1 tools can collide with Mastra Code remapped tool names or bypass hook wrappers.
- Tool taxonomy may not match Mastra Code permission categories.
- Tool result rendering expects Mastra Code formats.

## Feature surfaces to retest

- All core tools listed in model prompt with expected names.
- Hooks fire pre/post for tool calls.
- Permission prompts use Mastra Code categories.

## Commit headlines

- `c30701d90c` feat(core): add Harness v1 built-in tools

## Changed files

- `.changeset/honest-sides-rescue.md` (+5 / -0)
- `packages/core/src/harness/v1/index.ts` (+17 / -0)
- `packages/core/src/harness/v1/session.message.test.ts` (+1 / -1)
- `packages/core/src/harness/v1/session.signal.test.ts` (+1 / -1)
- `packages/core/src/harness/v1/session.ts` (+4 / -3)
- `packages/core/src/harness/v1/tools.test.ts` (+154 / -0)
- `packages/core/src/harness/v1/tools.ts` (+225 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
