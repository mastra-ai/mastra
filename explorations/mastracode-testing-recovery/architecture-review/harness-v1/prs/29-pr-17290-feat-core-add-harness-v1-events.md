# PR #17290: feat(core): add harness v1 events

Source: https://github.com/mastra-ai/mastra/pull/17290

Order: 29 of 34

Status: Merged at 2026-06-01T11:21:45Z

Stack edge: `main` -> `wardpeet/harness-v1-p2`

Diff size: +539 / -2; 8 changed files.

## Before

Harness v1 event APIs were not fully exposed as core public primitives.

## What changed

Added Harness v1 events.

## Why this is suspicious

- Event API changes affect the entire TUI bridge.
- If event kinds/payloads drift from legacy handlers, UI silently drops updates.
- Event ordering and IDs affect tool/message reconciliation.

## Feature surfaces to retest

- All TUI handler event categories.
- Tool streaming and shell output.
- Subagent event display.

## Commit headlines

- `70d88277ae` feat(core): add harness v1 events
- `2434c2ffe2` fix(core): keep harness event API focused
- `4f241ab9e4` fix(core): address harness event review feedback

## Changed files

- `.changeset/eager-beers-sip.md` (+15 / -0)
- `packages/core/src/harness/v1/events.test.ts` (+83 / -0)
- `packages/core/src/harness/v1/events.ts` (+291 / -0)
- `packages/core/src/harness/v1/harness.ts` (+15 / -0)
- `packages/core/src/harness/v1/index.ts` (+2 / -0)
- `packages/core/src/harness/v1/session.test.ts` (+106 / -0)
- `packages/core/src/harness/v1/session.ts` (+25 / -2)
- `packages/core/src/harness/v1/session.types.ts` (+2 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
