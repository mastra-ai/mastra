# PR #16848: feat(core): add Harness v1 session accessors

Source: https://github.com/mastra-ai/mastra/pull/16848

Order: 7 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-session-state` -> `feat/harness-v1-session-operations`

Diff size: +998 / -2; 5 changed files.

## Before

Legacy harness exposed direct accessors for threads, model/mode, state, and run controls.

## What changed

Added v1 session accessors. This made sessions externally queryable/mutable in the v1 model.

## Why this is suspicious

- Accessor names can look equivalent while returning session-local values instead of composed legacy values.
- Missing defensive fallbacks cause crashes when no v1 session exists; PR #17511 later fixed `switchMode` without active session.
- Accessors can bypass legacy hooks/events if used directly.

## Feature surfaces to retest

- Call accessors before a session is active.
- Call accessors after thread switch/clone.
- Verify legacy-compatible surface still returns complete state.

## Commit headlines

- `4bb0dc82b9` feat(core): add harness v1 session accessors

## Changed files

- `.changeset/shaggy-crabs-brush.md` (+5 / -0)
- `packages/core/src/harness/_shared/message-conversion.ts` (+337 / -0)
- `packages/core/src/harness/v1/list-messages.test.ts` (+387 / -0)
- `packages/core/src/harness/v1/session.accessors.test.ts` (+138 / -0)
- `packages/core/src/harness/v1/session.ts` (+131 / -2)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
