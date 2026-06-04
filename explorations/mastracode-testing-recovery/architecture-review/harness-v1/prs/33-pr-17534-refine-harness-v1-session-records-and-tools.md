# PR #17534: Refine Harness v1 session records and tools

Source: https://github.com/mastra-ai/mastra/pull/17534

Order: 33 of 34

Status: OPEN; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `main` -> `wardpeet/harness-tools-subagent`

Diff size: +1569 / -365; 22 changed files.

## Before

V1 session records/tools/subagent handling had rough edges after state composition.

## What changed

Refined Harness v1 session records and tools; touched `HarnessCompat`, agents, index, and core session/tool code.

## Why this is suspicious

- Open PR means this may be a moving target but it changes exactly the danger zones: session records, tool surfacing, subagent interaction.
- Tool refinement can break permissions/hooks/rendering.
- Subagent refinement can reintroduce v0/v1 duplication or wrong model routing.

## Feature surfaces to retest

- Tool list/schema snapshot in prompt.
- Tool approval and hook wrapping.
- Subagent start/tool/end UI.
- Session record persistence after restart.

## Commit headlines

- `5e03bb830f` feat(core): add state and workspace to harness v1
- `8f53aab764` chore: remove harness v1 changesets
- `85bce1b05b` feat(core): compose session state in harness compat
- `9fa2740f90` fix(core): keep subagent model state in harness compat
- `cd60fd98f3` chore: remove harness compat changesets
- `a745194454` refactor(core): move state ownership from Harness v1 to Session
- `50c1a0359c` refactor(core): simplify v1 session workspace to single DynamicArgument
- `6d0d6c404f` fix(mastracode): preserve model when switching threads
- `0dcd409a16` fix(mastracode): read composed harness state defensively
- `ccbd9ac9e3` feat(core): add v1 harness tools and canonical skills
- `44716a4444` fix(mastracode): keep v0 subagents out of harness v1
- `f56445ca5e` update requestContext
- `c41f576385` refactor(core): simplify harness v1 session records
- `c82f0c63ea` fix(mastracode): restore GitHub signals compat

## Changed files

- `mastracode/src/HarnessCompat.test.ts` (+0 / -15)
- `mastracode/src/HarnessCompat.ts` (+6 / -4)
- `mastracode/src/agents/tools.ts` (+0 / -54)
- `mastracode/src/index.ts` (+2 / -5)
- `packages/core/src/harness/v1/events.ts` (+12 / -0)
- `packages/core/src/harness/v1/harness.state-workspace.test.ts` (+79 / -5)
- `packages/core/src/harness/v1/harness.tools.test.ts` (+200 / -41)
- `packages/core/src/harness/v1/harness.ts` (+65 / -78)
- `packages/core/src/harness/v1/harness.types.ts` (+9 / -17)
- `packages/core/src/harness/v1/index.ts` (+2 / -3)
- `packages/core/src/harness/v1/request-context.ts` (+32 / -0)
- `packages/core/src/harness/v1/session.test.ts` (+155 / -14)
- `packages/core/src/harness/v1/session.ts` (+465 / -68)
- `packages/core/src/harness/v1/session.types.ts` (+27 / -8)
- `packages/core/src/harness/v1/skills.test.ts` (+19 / -41)
- `packages/core/src/harness/v1/skills.types.ts` (+13 / -3)
- `packages/core/src/harness/v1/tools.ts` (+255 / -0)
- `packages/core/src/storage/domains/harness/base.ts` (+75 / -1)
- `packages/core/src/storage/domains/harness/index.ts` (+1 / -1)
- `packages/core/src/storage/domains/harness/inmemory.test.ts` (+72 / -5)
- `packages/core/src/storage/domains/harness/inmemory.ts` (+36 / -1)
- `packages/core/src/storage/domains/harness/types.ts` (+44 / -1)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
