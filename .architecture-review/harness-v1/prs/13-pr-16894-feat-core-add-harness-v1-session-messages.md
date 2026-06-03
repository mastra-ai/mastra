# PR #16894: feat(core): add Harness v1 session messages

Source: https://github.com/mastra-ai/mastra/pull/16894

Order: 13 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-attachments` -> `feat/harness-v1-session-message`

Diff size: +638 / -2; 3 changed files.

## Before

Legacy harness messages were the canonical chat stream representation for Mastra Code.

## What changed

Added Harness v1 session messages.

## Why this is suspicious

- This is a major compatibility seam: TUI rendering, headless output, thread history, and memory all depend on message shape.
- If v1 messages do not preserve legacy metadata/data parts, features break without type errors.
- Message-first APIs later changed again, increasing churn.

## Feature surfaces to retest

- Render existing messages after restart.
- Thread history sent to model.
- Signals and multimodal parts in messages.

## Commit headlines

- `b7342ae234` feat(core): add Harness v1 session messages

## Changed files

- `.changeset/tasty-pans-beam.md` (+5 / -0)
- `packages/core/src/harness/v1/session.message.test.ts` (+268 / -0)
- `packages/core/src/harness/v1/session.ts` (+365 / -2)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
