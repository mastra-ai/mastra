# PR #16827: feat(core): add Harness v1 storage domain

Source: https://github.com/mastra-ai/mastra/pull/16827

Order: 4 of 34

Status: Merged at 2026-05-20T15:25:10Z

Stack edge: `feat/harness-v1-type-layer` -> `feat/harness-storage-domain`

Diff size: +1112 / -82; 15 changed files.

## Before

Legacy harness persisted threads/messages/state via existing storage abstractions without a separate v1 storage domain.

## What changed

Added Harness v1 storage domain primitives. This starts separating v1 session/run/task persistence from legacy harness persistence.

## Why this is suspicious

- Separate storage domains create duplicate sources of truth for thread/session state.
- Startup/resume can fail if old and new records disagree.
- Resource ID and project path scoping must match Mastra Code expectations exactly.

## Feature surfaces to retest

- Create/resume Mastra Code threads across restarts.
- Switch resources/projects and verify threads do not bleed across projects.
- Verify fallback LibSQL and Postgres storage both initialize v1 records.

## Commit headlines

- `300dcc5464` feat(core): add harness storage domain

## Changed files

- `.changeset/brave-bobcats-dress.md` (+18 / -0)
- `packages/core/package.json` (+10 / -0)
- `packages/core/src/harness/v1/types.ts` (+18 / -82)
- `packages/core/src/storage/base.ts` (+4 / -0)
- `packages/core/src/storage/domains/harness/base.ts` (+167 / -0)
- `packages/core/src/storage/domains/harness/index.ts` (+3 / -0)
- `packages/core/src/storage/domains/harness/inmemory.test.ts` (+291 / -0)
- `packages/core/src/storage/domains/harness/inmemory.ts` (+249 / -0)
- `packages/core/src/storage/domains/harness/types.ts` (+295 / -0)
- `packages/core/src/storage/domains/index.ts` (+1 / -0)
- `packages/core/src/storage/domains/inmemory-db.ts` (+9 / -0)
- `packages/core/src/storage/mock.test.ts` (+43 / -0)
- `packages/core/src/storage/mock.ts` (+2 / -0)
- `packages/core/storage/domains/harness.d.ts` (+1 / -0)
- `packages/core/tsup.config.ts` (+1 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
