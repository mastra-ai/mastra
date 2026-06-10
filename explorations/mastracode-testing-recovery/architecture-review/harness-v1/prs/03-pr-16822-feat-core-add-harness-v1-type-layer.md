# PR #16822: feat(core): add harness v1 type layer

Source: https://github.com/mastra-ai/mastra/pull/16822

Order: 3 of 34

Status: Merged at 2026-05-20T13:19:27Z

Stack edge: `chore/harness-v1-subpath-scaffold` -> `feat/harness-v1-type-layer`

Diff size: +1603 / -2; 9 changed files.

## Before

Harness types were legacy-first: events, messages, state, modes, subagents, tools, suspensions, and metadata were centered around the old harness contract.

## What changed

Introduced the Harness v1 type layer: session/runtime/task/evidence/state/event contracts that later PRs implement.

## Why this is suspicious

- Type layer decisions hard-code semantics before runtime compatibility is proven.
- If v1 names overlap but differ subtly from legacy names, compatibility adapters can pass type checks while changing behavior.
- The type layer likely lacks Mastra Code product-specific invariants such as active plan, task list, goals, and signal delivery attributes.

## Feature surfaces to retest

- Compare v1 event/message/state types against legacy Mastra Code event handlers.
- Audit whether every legacy suspension kind has a v1 equivalent.
- Check type exports for stable public API.

## Commit headlines

- `7a49669dce` feat(core): add harness v1 type layer

## Changed files

- `.changeset/fuzzy-cities-throw.md` (+9 / -0)
- `packages/core/src/harness/v1/config.ts` (+111 / -0)
- `packages/core/src/harness/v1/context.ts` (+42 / -0)
- `packages/core/src/harness/v1/errors.ts` (+227 / -0)
- `packages/core/src/harness/v1/events.ts` (+592 / -0)
- `packages/core/src/harness/v1/harness.ts` (+11 / -2)
- `packages/core/src/harness/v1/index.ts` (+160 / -0)
- `packages/core/src/harness/v1/session.ts` (+2 / -0)
- `packages/core/src/harness/v1/types.ts` (+449 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
