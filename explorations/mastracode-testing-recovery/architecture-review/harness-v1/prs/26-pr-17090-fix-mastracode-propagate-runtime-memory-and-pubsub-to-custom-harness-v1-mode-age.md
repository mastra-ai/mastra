# PR #17090: fix(mastracode): propagate runtime memory and pubsub to custom Harness v1 mode agents

Source: https://github.com/mastra-ai/mastra/pull/17090

Order: 26 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `mohamed/mastra-4340-multiselect-questions` -> `mohamed/mastra-4342-runtime-service-propagation`

Diff size: +272 / -40; 6 changed files.

## Before

Custom Harness v1 mode agents did not reliably receive Mastra Code runtime memory/pubsub context.

## What changed

Propagated runtime memory and pubsub to custom Harness v1 mode agents.

## Why this is suspicious

- Custom mode agents could run without OM, storage, or signal routing.
- Dynamic memory factory depends on request context; missing propagation changes model behavior silently.
- Pubsub gaps break signal delivery and cross-process thread updates.

## Feature surfaces to retest

- Custom mode with memory enabled.
- Signals while custom mode agent runs.
- OM observer/reflector with custom model settings.

## Commit headlines

- `89e28a1a04` fix(mastracode): propagate runtime memory and pubsub to custom Harnes…

## Changed files

- `.changeset/pretty-carrots-rest.md` (+31 / -0)
- `mastracode/src/harness/config.ts` (+2 / -0)
- `mastracode/src/harness/index.ts` (+1 / -5)
- `mastracode/src/harness/runtime.test.ts` (+201 / -6)
- `mastracode/src/harness/runtime.ts` (+29 / -19)
- `mastracode/src/index.ts` (+8 / -10)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
