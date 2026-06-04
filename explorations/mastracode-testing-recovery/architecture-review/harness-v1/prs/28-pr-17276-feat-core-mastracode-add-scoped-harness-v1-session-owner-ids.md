# PR #17276: feat(core, mastracode): add scoped Harness V1 session owner IDs

Source: https://github.com/mastra-ai/mastra/pull/17276

Order: 28 of 34

Status: Merged at 2026-06-01T09:02:16Z

Stack edge: `main` -> `wardpeet/harness-v1`

Diff size: +1850 / -139; 22 changed files.

## Before

V1 session ownership was not scoped strongly enough for multi-owner/session scenarios.

## What changed

Added scoped Harness V1 session owner IDs across core and Mastra Code. Updated `HarnessCompat` and startup integration.

## Why this is suspicious

- Owner IDs are another axis of session lookup. A mismatch can make Mastra Code read the wrong session or fail to find one.
- Thread switching, clone, subagents, and forks all need correct owner scoping.
- This can break existing persisted sessions unless migration/defaulting is careful.

## Feature surfaces to retest

- Start TUI, subagent, and headless flows in same project.
- Clone/fork thread and verify owner ID separation.
- Resume old pre-owner sessions.

## Commit headlines

- `259bd9ae45` setup simple mode refactor for harness v1
- `fce9243a7e` feat(core): persist harness v1 sessions
- `81c55c4deb` feat(core): add harness owner ids
- `ff44bcc54d` fix(mastracode): satisfy harness owner lint
- `bb6c18d9c3` fix(core): address harness owner review
- `6e79db863a` Merge branch 'main' into wardpeet/harness-v1

## Changed files

- `mastracode/src/HarnessCompat.ts` (+182 / -0)
- `mastracode/src/__tests__/index.test.ts` (+91 / -7)
- `mastracode/src/index.ts` (+239 / -131)
- `mastracode/src/tui/commands/threads.ts` (+1 / -0)
- `packages/core/package.json` (+10 / -0)
- `packages/core/src/harness/v1/harness.ts` (+198 / -0)
- `packages/core/src/harness/v1/harness.types.ts` (+265 / -0)
- `packages/core/src/harness/v1/index.ts` (+3 / -0)
- `packages/core/src/harness/v1/mode.test.ts` (+104 / -0)
- `packages/core/src/harness/v1/mode.ts` (+67 / -0)
- `packages/core/src/harness/v1/session.test.ts` (+344 / -0)
- `packages/core/src/harness/v1/session.ts` (+165 / -0)
- `packages/core/src/harness/v1/session.types.ts` (+39 / -0)
- `packages/core/src/storage/base.ts` (+4 / -0)
- `packages/core/src/storage/domains/harness/base.ts` (+17 / -0)
- `packages/core/src/storage/domains/harness/index.ts` (+3 / -0)
- `packages/core/src/storage/domains/harness/inmemory.test.ts` (+69 / -0)
- `packages/core/src/storage/domains/harness/inmemory.ts` (+31 / -0)
- `packages/core/src/storage/domains/harness/types.ts` (+12 / -0)
- `packages/core/src/storage/domains/index.ts` (+1 / -0)
- `packages/core/src/storage/mock.ts` (+4 / -1)
- `packages/core/tsup.config.ts` (+1 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
