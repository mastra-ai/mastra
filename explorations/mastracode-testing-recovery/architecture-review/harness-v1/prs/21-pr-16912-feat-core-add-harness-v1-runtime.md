# PR #16912: feat(core): add Harness v1 runtime

Source: https://github.com/mastra-ai/mastra/pull/16912

Order: 21 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `main` -> `feat/harness-v1-complete-core`

Diff size: +106368 / -4062; 100 changed files.

## Before

Harness v1 existed as stacked pieces; main did not have the full runtime. Mastra Code still relied on legacy Harness.

## What changed

Massive core runtime integration of Harness v1. This pulled together type layer, storage, registry, sessions, messages, signals, queue, permissions, suspensions, tools, display state, and goals.

## Why this is suspicious

- Very large diff makes semantic regressions hard to isolate.
- Core runtime was introduced before Mastra Code runtime adoption was fully proven.
- Any v1 contract mismatch is inherited by all later compatibility work.

## Feature surfaces to retest

- Full core harness v1 suite.
- Legacy harness API compatibility.
- Mastra Code startup before adapter.
- Storage migrations/fallbacks.

## Commit headlines

- `3abcdd2da7` chore(core): rename legacy harness class
- `8550d38d14` feat(core): add harness v1 subpath scaffold (#16818)
- `2adf3c9230` chore(core): keep harness legacy rename scoped
- `a150b4c885` feat(core): add Harness v1 runtime
- `34b5991fe7` Merge remote-tracking branch 'origin/main' into pr-16912-parent-stack
- `2cebe7729a` feat(core): harden harness v1 parent stack
- `7c76149ce9` Merge remote-tracking branch 'origin/main' into pr-16912-parent-stack
- `fccb74624a` fix(storage): register harness workspace actions table
- `18d952147c` fix(core): resolve subagent model ids explicitly
- `265929c307` fix(core): defer harness runtime ids for workers
- `3d448a6c5a` fix(core): retry stale unix pubsub writes
- `3bd182e2cd` Merge remote-tracking branch 'origin/main' into pr-16912-parent-stack
- `aae56acae4` fix(core): await shared stream consumption before memory recall
- `f865918962` test(lance): await vector table cleanup
- `44380987e7` Merge remote-tracking branch 'origin/main' into pr-16912-parent-stack
- `671100a097` fix(harness): move runtime compatibility into parent stack
- `fe3cab97e8` fix(harness): expose turn model in request context
- `c8608ae28a` fix(harness): bridge observational memory events in v1
- `4a802aa86b` fix(harness): honor yolo for v1 tool approvals
- `3e37674156` fix(harness): support forked v1 subagents
- `3d6762b445` fix(harness): resolve v1 tool permissions per call
- `a374f2681d` fix(harness): preserve late om stream events
- `4d4aaf8afa` feat(harness): expose live signal route
- `3b70b5d1d6` fix(harness): validate custom event emission
- `c84d19153b` Merge remote-tracking branch 'origin/main' into pr-16912-parent-stack
- `687d16cf43` docs(harness): document storage capability boundaries
- `b446053691` fix(harness): replay events for closed sessions
- `48ac420d50` fix(harness): bridge om activation events
- `c974e1d362` chore(harness): update generated route metadata
- `021afb8bf8` feat(harness): filter workspace action journal entries
- `9c465e5e92` fix(harness): harden v1 runtime leases and journaling
- `0ca8714ed8` Merge remote-tracking branch 'origin/main' into pr-16912-parent-stack
- `a22cb247d4` fix(harness): harden reconnect evidence and replay
- `0b06ad38b6` fix(harness): keep attachment delete as raw response
- `796179ec62` feat(client-js): add remote harness session resource
- `729b7bca93` fix(server-adapters): forward headers to route handlers
- `1b62ed87a4` fix(client-js): parse harness SSE CRLF frames
- `f418f48567` fix(harness): tighten remote session recovery contracts
- `4b7544b83c` fix(harness): tighten remote recovery surface
- `9091ebf0f4` fix(harness): consolidate replay and workspace action taxonomy
- `967afbf06f` fix(server): keep harness event parser peer compatible
- `68aa8e9ab0` fix(harness): harden session resolution and workspace evidence
- `9e42158e42` fix(harness): harden runtime history and workspace evidence
- `0bc44cb88d` Merge remote-tracking branch 'origin/main' into pr-16912-parent-stack
- `44fb7e656c` fix(core/harness): persist token usage across rehydration
- `cfb19d7d2f` fix(core/harness): tear down dormant per-session workspaces on delete
- `698dd503ad` feat(core/harness): declare storage capability matrix as runtime API
- `32dd7e3a11` feat(core/harness): reap orphan background processes on session lifec…
- `108da25163` feat(core/harness): lease-extension API + heartbeat coordination
- `c19a2fdbdd` feat(core/harness): goal-judge failure mode taxonomy
- `cbb3c3343d` feat(core/harness): subagent session retention policy
- `7f167553db` feat(core/harness): classify network and MCP workspace actions
- `f272f9c1cb` feat(core/harness): enforce workspace policy for file/command/network…
- `8c309a1ca4` feat(core/harness): clean subagent thread + message rows alongside se…
- `40334d8cc2` refactor(core/harness): consolidate workspace-* modules under harness…
- `f8fb7ba8ad` refactor(core/harness): move spawn-subagent tool under builtin-tools/
- `7759e1acb3` fix(core/harness): snapshot EventEmitter listeners before dispatch
- `ffe7272269` fix(core/harness/v1): allow afterSequence=-1 to replay from the first…
- `2d48301225` feat(core/harness/v1): typed HarnessEventReplayUnsupportedError on re…
- `2e7f134a24` fix(core/harness/v1): propagate agent error finishes as agent_end.rea…
- `02f3d93f84` feat(core/harness/v1): emit session_deleted on hard-delete lifecycle
- `91282db1c1` feat(core/harness/v1): add bridgeReplayAndLive replay-aware event stream
- `e0c17e51bd` feat(core/harness/v1): public-view event projector + bridge opt-in
- `6b9332fbc7` feat(core/harness/v1): durable artifact substrate
- `37f8583527` feat(core/harness/v1): permission profile primitive + 4 presets + app…
- `66aa638458` feat(core/harness/v1): per-actor permission grants on Harness v1 sess…
- `c97fa73c8f` feat(core/harness/v1): wire per-call args through the permission reso…
- `1b2c450122` feat(core/harness/v1): subagent type profile binding
- `cdfdc1e8c8` feat(core/harness/v1): sandbox-access request API
- `48706db66a` refactor(core/harness/v1): rename TaskItem to HarnessTodo (prep)
- `2aaf995965` feat(core/harness/v1): add canonical Task / Run type contracts
- `b704ddae97` feat(core/harness/v1): canonical HarnessEvidence union + admission ty…
- `fc381917af` feat(core/harness/v1): re-export PendingResume as PendingInteraction
- `06e845ae1e` feat(core/harness/v1): warn on unknown HarnessConfig keys at construc…
- `711a891eb8` feat(core/harness/v1): durable session cancellation primitive
- `a7d456e338` feat(core/harness/v1): cancellation tree propagation + resume gating
- `3ab00a94c2` fix(core/harness/v1): cancel race, active head, receipt audit gaps
- `0df0d195b3` feat(core/harness/v1): priority + deadline on the durable queue
- `176806bab6` fix(core/harness/v1): correct scheduler no-op short-circuit + clearer…
- `e57ec7a54b` fix(core): harden harness runtime contracts
- `11c4f5ca4f` test(e2e): stabilize type-check fixture install
- `3737bc0c7d` Merge branch 'main' into feat/harness-v1-complete-core
- `d84e6d393f` Merge branch 'main' into feat/harness-v1-complete-core

## Changed files

- `.changeset/action-catalog.md` (+13 / -0)
- `.changeset/afraid-regions-deny.md` (+6 / -0)
- `.changeset/busy-brooms-pump.md` (+5 / -0)
- `.changeset/cozy-crews-live.md` (+5 / -0)
- `.changeset/dry-jokes-tickle.md` (+7 / -0)
- `.changeset/famous-mammals-appear.md` (+19 / -0)
- `.changeset/five-points-fix.md` (+7 / -0)
- `.changeset/funny-tools-lie.md` (+23 / -0)
- `.changeset/harness-audit-fixes.md` (+15 / -0)
- `.changeset/harness-reconnect-evidence.md` (+12 / -0)
- `.changeset/harness-v1-core-compatibility.md` (+7 / -0)
- `.changeset/harness-v1-runtime-hardening.md` (+5 / -0)
- `.changeset/lucky-times-raise.md` (+9 / -0)
- `.changeset/mastra-readiness-lifecycle.md` (+15 / -0)
- `.changeset/nine-ideas-rule.md` (+7 / -0)
- `.changeset/orange-hands-dream.md` (+8 / -0)
- `.changeset/plenty-nails-heal.md` (+5 / -0)
- `.changeset/proud-papers-fall.md` (+11 / -0)
- `.changeset/quick-heads-own.md` (+13 / -0)
- `.changeset/rare-rats-wish.md` (+9 / -0)
- `.changeset/runtime-compatibility-generation.md` (+14 / -0)
- `.changeset/server-readiness.md` (+10 / -0)
- `.changeset/spotty-hotels-draw.md` (+5 / -0)
- `.changeset/tall-cameras-lose.md` (+11 / -0)
- `.changeset/workspace-action-journal.md` (+26 / -0)
- `.changeset/workspace-journal-filters.md` (+26 / -0)
- `client-sdks/client-js/src/client.ts` (+3 / -0)
- `client-sdks/client-js/src/resources/harness.test.ts` (+270 / -0)
- `client-sdks/client-js/src/resources/harness.ts` (+452 / -0)
- `client-sdks/client-js/src/resources/index.ts` (+1 / -0)
- `client-sdks/client-js/src/route-types.generated.ts` (+2151 / -92)
- `client-sdks/react/src/agent/hooks.ts` (+2 / -1)
- `docs/src/content/en/reference/harness/harness-class.mdx` (+31 / -0)
- `e2e-tests/type-check/template/package.json` (+5 / -0)
- `packages/cli/src/commands/api/route-metadata.generated.ts` (+2860 / -1704)
- `packages/core/package.json` (+10 / -0)
- `packages/core/scripts/generate-model-docs.ts` (+5 / -1)
- `packages/core/src/agent/__tests__/agent-fga.test.ts` (+1525 / -26)
- `packages/core/src/agent/__tests__/agent-signals.test.ts` (+3576 / -985)
- `packages/core/src/agent/__tests__/request-context-schema.test.ts` (+152 / -0)
- `packages/core/src/agent/__tests__/thread-stream-runtime-global-scope.test.ts` (+28 / -0)
- `packages/core/src/agent/__tests__/tool-concurrency.test.ts` (+6 / -2)
- `packages/core/src/agent/agent-legacy.ts` (+41 / -3)
- `packages/core/src/agent/agent-network.test.ts` (+476 / -0)
- `packages/core/src/agent/agent.ts` (+1355 / -243)
- `packages/core/src/agent/agent.types.ts` (+20 / -0)
- `packages/core/src/agent/durable/preparation.ts` (+17 / -4)
- `packages/core/src/agent/durable/utils/resolve-runtime.ts` (+19 / -16)
- `packages/core/src/agent/durable/utils/serialize-state.test.ts` (+79 / -0)
- `packages/core/src/agent/durable/utils/serialize-state.ts` (+12 / -2)
- `packages/core/src/agent/durable/workflows/steps/tool-call.ts` (+6 / -1)
- `packages/core/src/agent/message-list/message-list.ts` (+43 / -11)
- `packages/core/src/agent/stream-until-idle.ts` (+10 / -4)
- `packages/core/src/agent/thread-stream-runtime.ts` (+805 / -124)
- `packages/core/src/agent/types.ts` (+9 / -0)
- `packages/core/src/agent/workflows/prepare-stream/index.ts` (+4 / -0)
- `packages/core/src/agent/workflows/prepare-stream/prepare-tools-step.ts` (+1 / -0)
- `packages/core/src/agent/workflows/prepare-stream/stream-step.ts` (+3 / -1)
- `packages/core/src/auth/ee/interfaces/permissions.generated.ts` (+25 / -2)
- `packages/core/src/background-tasks/manager.test.ts` (+434 / -0)
- `packages/core/src/background-tasks/manager.ts` (+220 / -14)
- `packages/core/src/background-tasks/shutdown.ts` (+1 / -0)
- `packages/core/src/background-tasks/workflow.ts` (+29 / -16)
- `packages/core/src/channels/__tests__/integration.test.ts` (+42 / -1)
- `packages/core/src/events/unix-socket-pubsub.ts` (+92 / -19)
- `packages/core/src/harness/__tests__/harness-tool-suspension.test.ts` (+5 / -5)
- `packages/core/src/harness/_shared/message-conversion.ts` (+287 / -0)
- `packages/core/src/harness/clone-thread.test.ts` (+3 / -3)
- `packages/core/src/harness/display-state.test.ts` (+18 / -18)
- `packages/core/src/harness/fork-clone-metadata.test.ts` (+3 / -3)
- `packages/core/src/harness/get-om-record.test.ts` (+2 / -2)
- `packages/core/src/harness/harness.ts` (+123 / -37)
- `packages/core/src/harness/index.ts` (+10 / -1)
- `packages/core/src/harness/list-threads-fork-filter.test.ts` (+3 / -3)
- `packages/core/src/harness/mode-model-persistence.test.ts` (+3 / -3)
- `packages/core/src/harness/om-failure-abort.test.ts` (+2 / -2)
- `packages/core/src/harness/om-threshold-persistence.test.ts` (+2 / -2)
- `packages/core/src/harness/resource-id.test.ts` (+3 / -3)
- `packages/core/src/harness/signal-history.test.ts` (+2 / -2)
- `packages/core/src/harness/signal-messages.test.ts` (+30 / -28)
- `packages/core/src/harness/switch-model.test.ts` (+2 / -2)
- `packages/core/src/harness/task-tools.test.ts` (+13 / -42)
- `packages/core/src/harness/thread-locking.test.ts` (+72 / -7)
- `packages/core/src/harness/token-usage.test.ts` (+3 / -3)
- `packages/core/src/harness/tools.ts` (+15 / -30)
- `packages/core/src/harness/tracing-propagation.test.ts` (+3 / -3)
- `packages/core/src/harness/v1/__test-utils__/fake-output.ts` (+76 / -0)
- `packages/core/src/harness/v1/__test-utils__/index.ts` (+5 / -0)
- `packages/core/src/harness/v1/__test-utils__/mock-agent.ts` (+349 / -0)
- `packages/core/src/harness/v1/__test-utils__/setup.ts` (+83 / -0)
- `packages/core/src/harness/v1/attachments.test.ts` (+402 / -0)
- `packages/core/src/harness/v1/background-process-reap.test.ts` (+262 / -0)
- `packages/core/src/harness/v1/builtin-tools/__tests__/ask-user.test.ts` (+124 / -0)
- `packages/core/src/harness/v1/builtin-tools/__tests__/submit-plan.test.ts` (+132 / -0)
- `packages/core/src/harness/v1/builtin-tools/__tests__/task-check.test.ts` (+124 / -0)
- `packages/core/src/harness/v1/builtin-tools/__tests__/task-write.test.ts` (+109 / -0)
- `packages/core/src/harness/v1/builtin-tools/ask-user.ts` (+77 / -0)
- `packages/core/src/harness/v1/builtin-tools/index.ts` (+17 / -0)
- `packages/core/src/harness/v1/builtin-tools/shared.ts` (+44 / -0)
- `packages/core/src/harness/v1/builtin-tools/spawn-subagent.ts` (+468 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
