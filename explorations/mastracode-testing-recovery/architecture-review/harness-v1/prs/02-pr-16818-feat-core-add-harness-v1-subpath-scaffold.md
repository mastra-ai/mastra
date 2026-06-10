# PR #16818: feat(core): add harness v1 subpath scaffold

Source: https://github.com/mastra-ai/mastra/pull/16818

Order: 2 of 34

Status: Merged at 2026-05-20T14:53:34Z

Stack edge: `chore/harness-legacy-rename` -> `chore/harness-v1-subpath-scaffold`

Diff size: +56 / -0; 7 changed files.

## Before

There was no `@mastra/core/harness/v1` subpath. Consumers had only the legacy harness entrypoint.

## What changed

Added a Harness v1 subpath scaffold in core package exports/build config. This created the namespace where the new runtime could live independently of the legacy harness.

## Why this is suspicious

- Package export maps are easy to break for NodeNext, bundlers, and declaration generation.
- A new subpath can accidentally shadow or alter existing `@mastra/core/harness` exports.
- Mastra Code would not use v1 yet, so regressions may only show as import/build failures.

## Feature surfaces to retest

- Import legacy `@mastra/core/harness` from Mastra Code.
- Import v1 subpath from an isolated TypeScript fixture.
- Run package declaration build for core.

## Commit headlines

- `8c38a50092` feat(core): add harness v1 subpath scaffold

## Changed files

- `.changeset/tough-clubs-mate.md` (+11 / -0)
- `packages/core/package.json` (+10 / -0)
- `packages/core/src/harness/v1/harness.ts` (+3 / -0)
- `packages/core/src/harness/v1/index.ts` (+21 / -0)
- `packages/core/src/harness/v1/session.ts` (+3 / -0)
- `packages/core/src/harness/v1/shared.ts` (+7 / -0)
- `packages/core/tsup.config.ts` (+1 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
