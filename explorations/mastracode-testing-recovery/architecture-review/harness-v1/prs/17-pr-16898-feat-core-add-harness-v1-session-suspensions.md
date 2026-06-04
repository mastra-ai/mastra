# PR #16898: feat(core): add Harness v1 session suspensions

Source: https://github.com/mastra-ai/mastra/pull/16898

Order: 17 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-session-permissions` -> `feat/harness-v1-session-suspensions`

Diff size: +499 / -0; 4 changed files.

## Before

Legacy harness represented tool approvals, ask_user, plan approval, and sandbox access as suspensions/events consumed by TUI/headless.

## What changed

Added Harness v1 session suspensions.

## Why this is suspicious

- Suspension projection must preserve every prompt-specific field. Later fixes around `selectionMode` and sandbox workspace context prove this was risky.
- Incorrect suspension IDs cause responses to no-op or resume wrong execution.
- Inline prompt rendering can break if event kinds differ.

## Feature surfaces to retest

- ask_user single_select and multi_select.
- submit_plan approval.
- request_access with allowed paths.
- Tool approval while multiple tools pending.

## Commit headlines

- `2573f905a6` feat(core): add Harness v1 session suspensions

## Changed files

- `.changeset/icy-mangos-stand.md` (+5 / -0)
- `packages/core/src/harness/v1/session.suspension.test.ts` (+259 / -0)
- `packages/core/src/harness/v1/session.ts` (+233 / -0)
- `packages/core/src/storage/domains/harness/types.ts` (+2 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
