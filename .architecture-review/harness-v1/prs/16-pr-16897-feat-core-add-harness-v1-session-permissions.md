# PR #16897: feat(core): add Harness v1 session permissions

Source: https://github.com/mastra-ai/mastra/pull/16897

Order: 16 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-session-queue` -> `feat/harness-v1-session-permissions`

Diff size: +369 / -1; 3 changed files.

## Before

Mastra Code permissions lived in `MastraCodeState.permissionRules`, session grants, and YOLO policy.

## What changed

Added Harness v1 session permissions.

## Why this is suspicious

- Permission policy can now be enforced in two layers.
- YOLO can be ignored if v1 checks do not read the legacy state; PR #17042 later fixed YOLO approvals.
- Session grants may not map to actor/session-scoped permissions.

## Feature surfaces to retest

- YOLO toggle then execute command.
- Per-tool allow/ask/deny.
- Temporary approval/session grants.

## Commit headlines

- `54c3c734d4` feat(core): add Harness v1 session permissions

## Changed files

- `.changeset/dirty-lizards-obey.md` (+5 / -0)
- `packages/core/src/harness/v1/session.permissions.test.ts` (+207 / -0)
- `packages/core/src/harness/v1/session.ts` (+157 / -1)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
