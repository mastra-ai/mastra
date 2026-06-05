# Observational memory

## Origin PR / commit

- PR: [#13231](https://github.com/mastra-ai/mastra/pull/13231) — dynamic memory configuration, configurable thresholds, observational memory support.
- Later changes: [#13305](https://github.com/mastra-ai/mastra/pull/13305) — improved OM activation chunk selection, overshoot safeguards, and absolute buffer activation support; [#13330](https://github.com/mastra-ai/mastra/pull/13330) — restored streamed OM status/lifecycle events and observer/reflector model-change events; [#13349](https://github.com/mastra-ai/mastra/pull/13349) — temporarily raised observation `bufferActivation` to 4000 to avoid aggressive message-window shrinking while token-counting precision was investigated; [#13354](https://github.com/mastra-ai/mastra/pull/13354) — preserved OM continuation hints (`currentTask` / `suggestedContinuation`) through low-activation buffering and added degenerate observer-output guards; [#13421](https://github.com/mastra-ai/mastra/pull/13421) — added setup/global settings OM pack defaults; [#13427](https://github.com/mastra-ai/mastra/pull/13427) — centralized OM UI progress in `HarnessDisplayState`; [#13476](https://github.com/mastra-ai/mastra/pull/13476) — fixed buffering precision, mid-step activation, blockAfter semantics, and retained-context safeguards; [#13563](https://github.com/mastra-ai/mastra/pull/13563) — made Codex-resolved OM models and OM failure aborts work with Mastra Code streams; [#13569](https://github.com/mastra-ai/mastra/pull/13569) — clones thread-scoped OM, remaps message/thread IDs, and preserves resource-scoped sharing semantics when forking threads; [#13815](https://github.com/mastra-ai/mastra/pull/13815) — adds `createMastraCode({ omScope })` and disables async OM buffering when resource scope is active; [#13953](https://github.com/mastra-ai/mastra/pull/13953) — forwards image/file attachments into observer input and makes OM token counting attachment-aware.

## User-visible behavior

- What the user can do: use persistent observational memory across Mastra Code conversations/resources, configure thread-vs-resource scope before startup, control whether attachments are observed, and fork threads with relevant OM state preserved.
- Success looks like: observations/reflections happen in the background without polluting chat or forgetting important context; pasted/uploaded images/files are represented for the observer without inflated counts; forking a thread carries the relevant OM forward without mutating the source.
- Must preserve: observer/reflector model settings, thresholds, scope, attachment filters, provider-aware token counting, activation/window-retention behavior, continuation hints, message-ID remapping on clone, and loaded memory after restart.

## Entry points / commands

- Commands / shortcuts / flags: `/om` opens observer/reflector model and threshold settings; `/setup` chooses the default OM pack.
- Automatic triggers: memory factory attaches observational memory to agent runs; startup resolves global OM settings; OM events render progress/output.

## TUI states

- Idle: `/om` modal edits observer, reflector, thresholds, caveman mode, attachment observation.
- Active / modal / error: OM markers/output can appear before the active streaming component; quiet mode suppresses buffering markers.

## Headless / non-TUI behavior

- Supported: same memory factory attaches to headless runs.
- Not supported / unknown: no `/om` modal; settings must be preconfigured.

## Streaming / loading / interrupted states

- Streaming / loading: `data-om-status`, observation, buffering, activation, and failure chunks become harness OM events and update OM UI components. Observer output now carries `currentTask` / `suggestedContinuation` separately from durable observations. Mid-step buffering activation should happen as soon as thresholds are crossed, not wait for the next user turn.
- Abort / retry / resume: OM buffering/observation failures emit typed OM failure events, abort the active harness stream, reset abort state, and prevent partial `message_start`; degenerate observer output retries once and then fails the observer run.

## Streaming vs loaded-from-history behavior

- While actively streaming: OM markers/output are live UI components around the active response; continuation hints are captured from observer output and can be persisted into thread OM metadata or buffered chunks.
- After reload / history reconstruction: memory effects are available through stored memory and thread metadata; cloned threads should load cloned thread-scoped OM, while same-resource clones should share resource-scoped OM naturally. Transient OM progress markers should not resume as active work.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Observations/reflections | Memory storage + vector store when present | Agent memory retrieval |
| Observer/reflector models | Harness request context + thread settings + settings | OM model functions, `/setup`, `/om`, `om_model_changed` subscribers, Codex OAuth remapping |
| Thresholds | Harness state + thread settings + settings | Memory factory, `/om` |
| OM UI progress | Harness display state + transient TUI components | Chat/status rendering |
| OM scope | `createMastraCode({ omScope })` override, then `MASTRA_OM_SCOPE`, project/global `database.json`, then `thread` default | Memory factory, OM storage keying |
| Resource-scope buffering | `getDynamicMemory()` disables `bufferTokens`/`bufferActivation` when scope is `resource` | Core OM validation and activation behavior |
| Attachment observation | Harness state/thread setting/global setting `observeAttachments` + core attachment filter | Observer input, `/om` modal, TUI image/file submit path |
| Attachment token estimates | `TokenCounter` cache + provider token-count endpoints + client-stamped estimates | OM threshold checks, context budgeting, observer-window token count |
| Buffer activation math | Core OM thresholds + storage `swapBufferedToActive()` | Runtime context trimming, async buffering, blockAfter fallback |
| Continuation hints | Observer output → buffered chunks / thread OM metadata | Next observer prompt, memory context injection, activation result |
| Cloned OM records | `Memory.cloneThread()` + storage OM domain | Thread/resource fork behavior, message-ID remapping, source-record preservation |

## Key files

- `mastracode/src/agents/memory.ts` — dynamic OM memory factory and Mastra Code defaults; current source sets observation `bufferActivation` to `2000` for thread scope, disables async buffering for resource scope, and passes `remapForCodexOAuth: true` for observer/reflector model resolution.
- `packages/memory/src/processors/observational-memory/thresholds.ts` — activation retention floor, `blockAfter` resolution, and chunk-boundary safeguards.
- `packages/memory/src/index.ts` — `cloneThread()` orchestration, OM clone rollback, message-ID remapping, resource-scope sharing, and xxhash thread-tag replacement.
- `packages/memory/src/processors/observational-memory/observational-memory.ts` — core OM runtime, mid-step activation decisions, attachment-aware token checks, and context injection (`<current-task>` / `<suggested-response>`).
- `packages/memory/src/processors/observational-memory/observer-runner.ts` — observer streaming call, request-context/abort propagation, attachment filter resolution, parsed continuation hints, and degenerate-output retry/failure.
- `packages/memory/src/processors/observational-memory/observer-agent.ts` — observer history formatting, attachment placeholders, tool-result attachment extraction, and image/file observer input parts.
- `packages/memory/src/processors/observational-memory/token-counter.ts` — provider-aware image/file token estimation, provider count-token calls, remote image probing, and estimate caching.
- `packages/memory/src/processors/observational-memory/observation-strategies/async-buffer.ts` — buffered chunk persistence for continuation hints.
- `packages/memory/src/processors/observational-memory/observation-strategies/sync.ts` — sync observation persistence into thread OM metadata.
- `packages/core/src/harness/harness.ts` — OM stream chunk handling, OM failure aborts, observer/reflector model switch events, and `Harness.cloneThread()` dynamic memory path.
- `packages/core/src/storage/domains/memory/*` and store-backed memory domains — OM storage APIs used by clone/read/history/insert paths.
- `mastracode/src/tui/commands/om.ts` — `/om` settings modal wiring, including observe-attachments persistence.
- `mastracode/src/tui/mastra-tui.ts` — pending pasted images, `[image]` placeholders, optimistic user messages, and Harness file/image signal dispatch.
- `mastracode/src/tui/handlers/om.ts` — OM event rendering.
- `mastracode/src/tui/components/om-settings.ts` — settings UI.
- `mastracode/src/index.ts` — `MastraCodeConfig.omScope` startup override, memory/vector store wiring, and heartbeat setup.
- `mastracode/src/schema.ts`, `utils/project.ts` — state schema and `getOmScope()` env/project/global/default precedence.

## Dependencies / related features

- [Interactive TUI chat](../tui/interactive-chat.md) — OM markers render around chat streaming.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — OM uses separate observer/reflector models.
- [Onboarding and global settings](../settings/onboarding-and-global-settings.md) — first-run setup selects default OM pack/model.
- [Harness display state](../integrations/harness-display-state.md) — OM status/progress fields used by TUI rendering.
- [Persistent conversations](../threads/persistent-conversations.md) — OM scope/reload depends on resource/thread context.
- [Resource ID switching](../threads/resource-id-switching.md) — resource changes determine whether resource-scoped OM is shared or cloned to a new resource.
- [Storage backend configuration](../settings/storage-backend.md) — selected storage/vector backend owns persisted observations and recall index.
- [File attachments in chat input](../chat/file-attachments.md) and [Clipboard paste](../tui/clipboard-paste.md) — attachments become message parts that OM may observe.

## Existing tests

- `mastracode/src/tui/commands/__tests__/om.test.ts` — OM role override persistence behavior.
- `mastracode/src/tui/components/__tests__/om-settings.test.ts` — model picker behavior for OM settings.
- `mastracode/src/tui/handlers/__tests__/om.test.ts` — OM marker rendering/quiet-mode behavior.
- `packages/memory/src/processors/observational-memory/__tests__/observational-memory.test.ts` — core activation, reflection, overshoot, retention behavior, blockAfter fallback, continuation-hint parsing, most-recent activated chunk hint selection, observer attachment formatting, tool-result attachment extraction, and image-heavy threshold checks.
- `packages/memory/src/processors/observational-memory/__tests__/token-counter.test.ts` — image/file token estimates, provider count-token endpoint fallback/caching/dedup, remote image probing, client-stamped estimates, and non-image file byte heuristics.
- `packages/memory/src/processors/observational-memory/__tests__/mid-loop-observation.test.ts` — mid-step observation/activation regressions, including async buffer activation without waiting for the next user turn.
- `packages/core/src/harness/om-failure-abort.test.ts`, `om-threshold-persistence.test.ts`, `get-om-record.test.ts` — core harness OM failure/abort, threshold, and record behavior.
- `packages/memory/src/clone-thread-om.test.ts` — thread-scoped OM clone, resource-scoped sharing/new-resource clone, message-ID remapping, transient-flag reset, malformed fields, current-generation-only clone, and Harness dynamic-memory clone path.
- `packages/memory/src/processors/observational-memory/__tests__/abort-signal.test.ts` — observer/reflector abort-signal guard behavior.
- `mastracode/src/utils/__tests__/gateway-sync.test.ts` — related heartbeat gateway sync wrapper.

## Missing tests

- End-to-end observation/reflection across restart with resource/thread scope, including `currentTask` / `suggestedContinuation` continuity.
- `/om` modal changes propagate to harness state, thread settings, settings file, and next memory factory instance.
- Mastra Code-specific test that `getDynamicMemory()` wires intended OM activation defaults into core memory.
- Direct tests for `getOmScope()` precedence and `createMastraCode({ omScope: 'resource' })` producing a resource-scoped memory config with async buffering disabled.
- Mastra Code `/om` command test asserting observer/reflector model changes call `switchObserverModel()` / `switchReflectorModel()` rather than raw `setState()`.
- Full TUI/Harness test that pasted images are submitted as file parts and then observed according to `observeAttachments`.
- Storage-backed integration coverage for OM clone across LibSQL/Postgres/Mongo/MySQL/Redis adapters, especially rollback and resource-scope new-resource clones.

## Known risks / regressions

- Memory factory cache key must include every setting that changes behavior.
- State is split across harness state, settings, thread settings, storage, and display state.
- Dynamic AGENTS.md reminders must not be observed into memory.
- Core OM activation defaults can drift from Mastra Code defaults; PR #13305 intended `bufferActivation: 1000` / `blockAfter: 1.2`, PR #13349 temporarily raised observation `bufferActivation` to `4000`, and current Mastra Code wiring is `bufferActivation: 2000` / `blockAfter: 2` after later precision/scope changes.
- Resource scope intentionally disables async buffering; enabling it without core support can throw validation errors or mix resource-wide buffered state unexpectedly.
- Attachment filtering and token counting are provider-sensitive; wrong mime-type detection, stale client estimates, or failed provider count endpoints can change when OM activates.
- Storage adapters must keep activation-boundary math in sync; in-memory, LibSQL, MongoDB, and PG each implement `swapBufferedToActive()`.
- Continuation hints are intentionally taken from the most recent activated chunk only; stale older hints must not leak forward after partial activation.
- OM observer/reflector model resolution must preserve requestContext so Codex OAuth remapping, reasoning effort, and gateway headers survive the memory pipeline.
- Clone must remap only messages included in `messageIdMap`; dropped source IDs must not leak into cloned OM. If OM clone fails after storage cloned the thread, rollback must delete the clone before vector embedding starts.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
