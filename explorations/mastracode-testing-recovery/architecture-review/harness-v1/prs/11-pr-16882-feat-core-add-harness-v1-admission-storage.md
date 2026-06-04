# PR #16882: feat(core): add Harness v1 admission storage

Source: https://github.com/mastra-ai/mastra/pull/16882

Order: 11 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-event-id-helpers` -> `feat/harness-v1-admission-storage`

Diff size: +951 / -1; 6 changed files.

## Before

Admission/approval state lived in legacy harness suspension/tool approval flows.

## What changed

Added Harness v1 admission storage.

## Why this is suspicious

- Approval/admission storage can desync from legacy pending approval UI.
- Decisions may resume the wrong run if IDs differ.
- Permissions can appear approved in one layer and blocked in another.

## Feature surfaces to retest

- Tool approval approve/deny in TUI.
- Headless auto-approval.
- Abort while approval is visible.

## Commit headlines

- `4dd3afab21` feat(core): add Harness v1 admission storage

## Changed files

- `.changeset/tangy-coats-act.md` (+26 / -0)
- `packages/core/src/storage/domains/harness/base.ts` (+69 / -0)
- `packages/core/src/storage/domains/harness/inmemory.test.ts` (+382 / -0)
- `packages/core/src/storage/domains/harness/inmemory.ts` (+377 / -0)
- `packages/core/src/storage/domains/harness/types.ts` (+87 / -0)
- `packages/core/src/storage/domains/inmemory-db.ts` (+10 / -1)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
