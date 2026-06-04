# PR #16879: Add latest Harness v1 runtime foundation

Source: https://github.com/mastra-ai/mastra/pull/16879

Order: 9 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-agent-run-output` -> `feat/harness-v1-latest-foundation-sync`

Diff size: +48194 / -177; 100 changed files.

## Before

Harness v1 foundation branches existed in pieces but were not yet synchronized into a combined stack.

## What changed

Synced the latest Harness v1 runtime foundation into the stacked branch.

## Why this is suspicious

- Foundation sync PRs can silently change assumptions from earlier PRs without focused Mastra Code tests.
- This likely pulled in cross-cutting runtime behavior before the Mastra Code adapter existed.
- Large stack syncs make later regressions hard to bisect.

## Feature surfaces to retest

- Run the complete v1 core test suite after sync.
- Diff event/state contracts against the prior branch tip.
- Check generated declaration output.

## Commit headlines

- `3dbe86cd46` chore(core): rename legacy harness class
- `8c38a50092` feat(core): add harness v1 subpath scaffold
- `7a49669dce` feat(core): add harness v1 type layer
- `300dcc5464` feat(core): add harness storage domain
- `df3ee88091` feat(core): add harness v1 registry
- `d3c99f275b` feat(core): add harness v1 session state
- `2156509669` feat(core): add harness v1 session accessors
- `5ab333bd20` feat(core): expose agent thread run outputs
- `0454bfd03b` feat(core): sync latest harness v1 foundation

## Changed files

- `.changeset/brave-bobcats-dress.md` (+18 / -0)
- `.changeset/calm-showers-build.md` (+5 / -0)
- `.changeset/cute-pots-admire.md` (+27 / -0)
- `.changeset/fuzzy-cities-throw.md` (+9 / -0)
- `.changeset/lucky-flies-fail.md` (+32 / -0)
- `.changeset/rare-rats-wish.md` (+9 / -0)
- `.changeset/shaggy-crabs-brush.md` (+5 / -0)
- `.changeset/solid-news-open.md` (+5 / -0)
- `.changeset/tough-clubs-mate.md` (+11 / -0)
- `packages/core/package.json` (+30 / -0)
- `packages/core/src/agent/__tests__/agent-thread-run-output.test.ts` (+202 / -0)
- `packages/core/src/agent/agent.ts` (+36 / -0)
- `packages/core/src/agent/thread-stream-runtime.ts` (+92 / -2)
- `packages/core/src/background-tasks/manager.test.ts` (+458 / -0)
- `packages/core/src/background-tasks/manager.ts` (+231 / -14)
- `packages/core/src/background-tasks/shutdown.ts` (+1 / -0)
- `packages/core/src/background-tasks/workflow.ts` (+37 / -16)
- `packages/core/src/harness/__tests__/harness-tool-suspension.test.ts` (+5 / -5)
- `packages/core/src/harness/_shared/message-conversion.ts` (+337 / -0)
- `packages/core/src/harness/clone-thread.test.ts` (+3 / -3)
- `packages/core/src/harness/display-state.test.ts` (+18 / -18)
- `packages/core/src/harness/fork-clone-metadata.test.ts` (+3 / -3)
- `packages/core/src/harness/get-om-record.test.ts` (+2 / -2)
- `packages/core/src/harness/harness.ts` (+2 / -2)
- `packages/core/src/harness/index.ts` (+7 / -1)
- `packages/core/src/harness/list-threads-fork-filter.test.ts` (+3 / -3)
- `packages/core/src/harness/mode-model-persistence.test.ts` (+3 / -3)
- `packages/core/src/harness/om-failure-abort.test.ts` (+2 / -2)
- `packages/core/src/harness/om-threshold-persistence.test.ts` (+2 / -2)
- `packages/core/src/harness/resource-id.test.ts` (+3 / -3)
- `packages/core/src/harness/signal-history.test.ts` (+2 / -2)
- `packages/core/src/harness/signal-messages.test.ts` (+3 / -3)
- `packages/core/src/harness/switch-model.test.ts` (+2 / -2)
- `packages/core/src/harness/task-tools.test.ts` (+4 / -4)
- `packages/core/src/harness/thread-locking.test.ts` (+5 / -5)
- `packages/core/src/harness/token-usage.test.ts` (+3 / -3)
- `packages/core/src/harness/tracing-propagation.test.ts` (+3 / -3)
- `packages/core/src/harness/v1/__test-utils__/fake-output.ts` (+76 / -0)
- `packages/core/src/harness/v1/__test-utils__/index.ts` (+5 / -0)
- `packages/core/src/harness/v1/__test-utils__/mock-agent.ts` (+353 / -0)
- `packages/core/src/harness/v1/__test-utils__/setup.ts` (+83 / -0)
- `packages/core/src/harness/v1/attachments.test.ts` (+406 / -0)
- `packages/core/src/harness/v1/channel-registry.ts` (+201 / -0)
- `packages/core/src/harness/v1/errors.ts` (+440 / -0)
- `packages/core/src/harness/v1/events.ts` (+951 / -0)
- `packages/core/src/harness/v1/export-map.test.ts` (+71 / -0)
- `packages/core/src/harness/v1/harness.modes.test.ts` (+90 / -0)
- `packages/core/src/harness/v1/harness.test.ts` (+3772 / -0)
- `packages/core/src/harness/v1/harness.ts` (+3748 / -0)
- `packages/core/src/harness/v1/index.ts` (+254 / -0)
- `packages/core/src/harness/v1/list-messages.test.ts` (+208 / -0)
- `packages/core/src/harness/v1/models.test.ts` (+170 / -0)
- `packages/core/src/harness/v1/session.abort.test.ts` (+222 / -0)
- `packages/core/src/harness/v1/session.builtin-tools.test.ts` (+347 / -0)
- `packages/core/src/harness/v1/session.discrete-accessors.test.ts` (+303 / -0)
- `packages/core/src/harness/v1/session.display-state.test.ts` (+143 / -0)
- `packages/core/src/harness/v1/session.events.test.ts` (+598 / -0)
- `packages/core/src/harness/v1/session.goal-judge.test.ts` (+112 / -0)
- `packages/core/src/harness/v1/session.goal.test.ts` (+434 / -0)
- `packages/core/src/harness/v1/session.injectSystemReminder.test.ts` (+170 / -0)
- `packages/core/src/harness/v1/session.message.test.ts` (+1300 / -0)
- `packages/core/src/harness/v1/session.mode-state.test.ts` (+109 / -0)
- `packages/core/src/harness/v1/session.models.test.ts` (+205 / -0)
- `packages/core/src/harness/v1/session.permissions.test.ts` (+248 / -0)
- `packages/core/src/harness/v1/session.queue.test.ts` (+2153 / -0)
- `packages/core/src/harness/v1/session.signal-routing.test.ts` (+84 / -0)
- `packages/core/src/harness/v1/session.signal.test.ts` (+267 / -0)
- `packages/core/src/harness/v1/session.skills.test.ts` (+423 / -0)
- `packages/core/src/harness/v1/session.skills.use.test.ts` (+714 / -0)
- `packages/core/src/harness/v1/session.spawn-subagent.test.ts` (+242 / -0)
- `packages/core/src/harness/v1/session.subagent-events.test.ts` (+272 / -0)
- `packages/core/src/harness/v1/session.subscription-lifecycle.test.ts` (+126 / -0)
- `packages/core/src/harness/v1/session.suspend.test.ts` (+1145 / -0)
- `packages/core/src/harness/v1/session.test.ts` (+278 / -0)
- `packages/core/src/harness/v1/session.tool-context.test.ts` (+357 / -0)
- `packages/core/src/harness/v1/session.ts` (+7762 / -0)
- `packages/core/src/harness/v1/spawn-subagent-tool.ts` (+282 / -0)
- `packages/core/src/harness/v1/threads.settings.test.ts` (+224 / -0)
- `packages/core/src/harness/v1/threads.test.ts` (+1293 / -0)
- `packages/core/src/harness/v1/types.ts` (+1728 / -0)
- `packages/core/src/harness/v1/workspace-provider.ts` (+89 / -0)
- `packages/core/src/harness/v1/workspace-registry.test.ts` (+267 / -0)
- `packages/core/src/harness/v1/workspace-registry.ts` (+571 / -0)
- `packages/core/src/harness/v1/workspace-runtime.test.ts` (+613 / -0)
- `packages/core/src/harness/v1/workspace-session.test.ts` (+195 / -0)
- `packages/core/src/harness/workspace-resolution.test.ts` (+10 / -10)
- `packages/core/src/mastra/index.ts` (+790 / -62)
- `packages/core/src/mastra/workers-filter.test.ts` (+1657 / -2)
- `packages/core/src/storage/base.ts` (+4 / -0)
- `packages/core/src/storage/domains/background-tasks/__tests__/base.test.ts` (+72 / -0)
- `packages/core/src/storage/domains/background-tasks/__tests__/inmemory.test.ts` (+15 / -0)
- `packages/core/src/storage/domains/background-tasks/base.ts` (+22 / -1)
- `packages/core/src/storage/domains/background-tasks/inmemory.ts` (+11 / -0)
- `packages/core/src/storage/domains/harness/base.ts` (+950 / -0)
- `packages/core/src/storage/domains/harness/index.ts` (+3 / -0)
- `packages/core/src/storage/domains/harness/inmemory.test.ts` (+2331 / -0)
- `packages/core/src/storage/domains/harness/inmemory.ts` (+3180 / -0)
- `packages/core/src/storage/domains/harness/types.ts` (+1049 / -0)
- `packages/core/src/storage/domains/index.ts` (+1 / -0)
- `packages/core/src/storage/domains/inmemory-db.ts` (+44 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
