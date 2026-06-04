# PR #16895: feat(core): add Harness v1 session signals

Source: https://github.com/mastra-ai/mastra/pull/16895

Order: 14 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-session-message` -> `feat/harness-v1-session-signals`

Diff size: +300 / -0; 3 changed files.

## Before

Signals were delivered through existing agent/harness signal mechanisms with Mastra Code-specific delivery labels (`while-active` vs `message`).

## What changed

Added Harness v1 session signals.

## Why this is suspicious

- Signal delivery timing is user-visible: active-run interjections must be tagged and routed correctly.
- Signals can become normal messages or vice versa.
- GitHub signals and notification inbox later depend on this path.

## Feature surfaces to retest

- Send user message while agent is active.
- Slash commands during active run.
- Signal data part hydration and delivery attributes.

## Commit headlines

- `acff8c1321` feat(core): add Harness v1 session signals

## Changed files

- `.changeset/late-rice-peel.md` (+5 / -0)
- `packages/core/src/harness/v1/session.signal.test.ts` (+168 / -0)
- `packages/core/src/harness/v1/session.ts` (+127 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
