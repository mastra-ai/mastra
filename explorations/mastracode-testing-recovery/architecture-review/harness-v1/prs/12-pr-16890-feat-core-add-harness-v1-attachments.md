# PR #16890: feat(core): add Harness v1 attachments

Source: https://github.com/mastra-ai/mastra/pull/16890

Order: 12 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-admission-storage` -> `feat/harness-v1-attachments`

Diff size: +1076 / -33; 9 changed files.

## Before

Mastra Code supported image/file attachments through legacy message parts and TUI `[image]` markers.

## What changed

Added Harness v1 attachments support.

## Why this is suspicious

- Attachment parts can be dropped or malformed during legacy/v1 message projection.
- Signal data part hydration later required a fix, indicating message part handling is fragile.
- OM attachment observation depends on correct media/text part preservation.

## Feature surfaces to retest

- Paste image into TUI and verify model receives it.
- Headless text file input / attachment handling if applicable.
- OM observeAttachments auto/on/off behavior.

## Commit headlines

- `861eccdd37` feat(core): add Harness v1 attachments

## Changed files

- `.changeset/ten-cobras-smash.md` (+30 / -0)
- `packages/core/src/harness/v1/harness.test.ts` (+474 / -7)
- `packages/core/src/harness/v1/harness.ts` (+318 / -4)
- `packages/core/src/harness/v1/types.ts` (+72 / -9)
- `packages/core/src/harness/v1/workspace-registry.ts` (+2 / -2)
- `packages/core/src/storage/domains/harness/base.ts` (+2 / -1)
- `packages/core/src/storage/domains/harness/inmemory.test.ts` (+60 / -6)
- `packages/core/src/storage/domains/harness/inmemory.ts` (+55 / -3)
- `packages/core/src/storage/domains/harness/types.ts` (+63 / -1)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
