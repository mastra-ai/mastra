# PR #17141: feat: add harness heartbeat handlers

Source: https://github.com/mastra-ai/mastra/pull/17141

Order: 27 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/mastracode-harness-v1-runtime` -> `fix/pr-16943-runtime-refresh`

Diff size: +1242 / -114; 15 changed files.

## Before

Harness heartbeat handling was incomplete in the runtime refresh branch.

## What changed

Added harness heartbeat handlers and Mastra Code heartbeat integration.

## Why this is suspicious

- Heartbeats affect gateway sync and long-lived session health.
- Duplicate or missing heartbeat handlers can cause background work to run too often or never.
- Cleanup on exit must stop heartbeat timers.

## Feature surfaces to retest

- Gateway sync heartbeat starts once.
- Exit cleanup stops workers/heartbeats.
- Long-running run does not leak timers.

## Commit headlines

- `c7ca272908` feat: add harness heartbeat handlers
- `b83a005544` test: align destroy error expectation
- `d3ebaf4fa9` fix: validate heartbeat timer intervals

## Changed files

- `.changeset/harness-v1-heartbeat-handlers.md` (+26 / -0)
- `.changeset/mastracode-harness-heartbeats.md` (+5 / -0)
- `mastracode/src/__tests__/index.test.ts` (+47 / -2)
- `mastracode/src/harness/config.ts` (+1 / -0)
- `mastracode/src/harness/runtime.test.ts` (+137 / -8)
- `mastracode/src/harness/runtime.ts` (+32 / -47)
- `mastracode/src/index.ts` (+2 / -0)
- `packages/core/src/harness/v1/harness.config-keys.test.ts` (+1 / -0)
- `packages/core/src/harness/v1/harness.ts` (+279 / -57)
- `packages/core/src/harness/v1/heartbeat.test.ts` (+659 / -0)
- `packages/core/src/harness/v1/index.ts` (+1 / -0)
- `packages/core/src/harness/v1/session.signal.test.ts` (+14 / -0)
- `packages/core/src/harness/v1/session.ts` (+1 / -0)
- `packages/core/src/harness/v1/types.ts` (+16 / -0)
- `packages/core/src/harness/v1/workspace-runtime.test.ts` (+21 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
