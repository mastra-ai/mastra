# PR #17402: feat(core): add harness v1 session message and queue APIs

Source: https://github.com/mastra-ai/mastra/pull/17402

Order: 30 of 34

Status: OPEN; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `main` -> `wardpeet/harness-v1-p3`

Diff size: +410 / -20; 11 changed files.

## Before

Session message/queue APIs existed in earlier stacked branches but were not mainline public APIs on current main.

## What changed

Added harness v1 session message and queue APIs, with `HarnessCompat` changes.

## Why this is suspicious

- Message and queue APIs directly affect active-run user messages, queued follow-ups, headless output, and history hydration.
- Open PR means the current branch may be testing a not-yet-merged behavior shape.
- If `HarnessCompat` routes through v1 sessions, legacy fallbacks become critical.

## Feature surfaces to retest

- Active-run while-active messages.
- Manual queued follow-ups.
- Render history after restart.
- Headless `--continue`.

## Commit headlines

- `cc17fbeadc` feat(core): add harness v1 session message and queue APIs
- `0317443b10` refactor(core): rename harness session messaging methods
- `ac0c601e5d` feat(mastracode): route HarnessCompat messages through v1 session

## Changed files

- `.changeset/eager-beers-sip.md` (+2 / -2)
- `.changeset/floppy-colts-know.md` (+5 / -0)
- `mastracode/src/HarnessCompat.ts` (+33 / -1)
- `packages/core/src/harness/v1/events.ts` (+26 / -2)
- `packages/core/src/harness/v1/harness.ts` (+16 / -0)
- `packages/core/src/harness/v1/harness.types.ts` (+1 / -1)
- `packages/core/src/harness/v1/index.ts` (+8 / -1)
- `packages/core/src/harness/v1/mode.test.ts` (+16 / -9)
- `packages/core/src/harness/v1/session.test.ts` (+143 / -3)
- `packages/core/src/harness/v1/session.ts` (+134 / -1)
- `packages/core/src/harness/v1/session.types.ts` (+26 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
