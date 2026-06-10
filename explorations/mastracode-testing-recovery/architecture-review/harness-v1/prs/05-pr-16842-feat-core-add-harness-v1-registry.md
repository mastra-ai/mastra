# PR #16842: feat(core): add Harness v1 registry

Source: https://github.com/mastra-ai/mastra/pull/16842

Order: 5 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-storage-domain` -> `feat/harness-v1-registry`

Diff size: +3360 / -31; 11 changed files.

## Before

There was no Harness v1 registry. Runtime ownership was implicit in the legacy Harness instance.

## What changed

Added Harness v1 registry infrastructure for sessions/runtimes. This enabled lookup and management of v1 entities.

## Why this is suspicious

- Registries introduce lifecycle/ownership issues: stale sessions, duplicate sessions, and wrong owner lookup.
- Mastra Code later hit stale lease recovery, suggesting registry/session lifecycle risk was real.
- Cross-process TUI/headless runs can disagree about active session ownership.

## Feature surfaces to retest

- Start two Mastra Code processes in the same project and verify locking/session ownership.
- Restart after crash and verify no stale session prevents startup.
- Clone/switch threads without orphaning sessions.

## Commit headlines

- `602c385cbb` feat(core): add harness v1 registry

## Changed files

- `.changeset/lucky-flies-fail.md` (+32 / -0)
- `packages/core/src/harness/v1/config.ts` (+23 / -19)
- `packages/core/src/harness/v1/events.ts` (+1 / -1)
- `packages/core/src/harness/v1/harness.test.ts` (+1007 / -0)
- `packages/core/src/harness/v1/harness.ts` (+1546 / -6)
- `packages/core/src/harness/v1/index.ts` (+8 / -0)
- `packages/core/src/harness/v1/session.ts` (+161 / -2)
- `packages/core/src/harness/v1/shared.ts` (+16 / -2)
- `packages/core/src/harness/v1/types.ts` (+17 / -1)
- `packages/core/src/harness/v1/workspace-provider.ts` (+31 / -0)
- `packages/core/src/harness/v1/workspace-registry.ts` (+518 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
