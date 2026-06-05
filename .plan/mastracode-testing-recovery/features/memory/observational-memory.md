# Observational memory

## Origin PR / commit

- PR: [#13231](https://github.com/mastra-ai/mastra/pull/13231) — dynamic memory configuration, configurable thresholds, observational memory support.
- Later changes: [#13305](https://github.com/mastra-ai/mastra/pull/13305) — improved OM activation chunk selection, overshoot safeguards, and absolute buffer activation support; [#13330](https://github.com/mastra-ai/mastra/pull/13330) — restored streamed OM status/lifecycle events and observer/reflector model-change events; [#13349](https://github.com/mastra-ai/mastra/pull/13349) — temporarily raised observation `bufferActivation` to 4000 to avoid aggressive message-window shrinking while token-counting precision was investigated; [#13354](https://github.com/mastra-ai/mastra/pull/13354) — preserved OM continuation hints (`currentTask` / `suggestedContinuation`) through low-activation buffering and added degenerate observer-output guards; [#13421](https://github.com/mastra-ai/mastra/pull/13421) — added setup/global settings OM pack defaults; [#13427](https://github.com/mastra-ai/mastra/pull/13427) — centralized OM UI progress in `HarnessDisplayState`; [#13476](https://github.com/mastra-ai/mastra/pull/13476) — fixed buffering precision, mid-step activation, blockAfter semantics, and retained-context safeguards; [#13568](https://github.com/mastra-ai/mastra/pull/13568) — added `observation.previousObserverTokens` so observer prompts get a token-bounded previous-observation window with buffered-reflection summaries and prior continuation metadata; [#13563](https://github.com/mastra-ai/mastra/pull/13563) — made Codex-resolved OM models and OM failure aborts work with Mastra Code streams; [#13569](https://github.com/mastra-ai/mastra/pull/13569) — clones thread-scoped OM, remaps message/thread IDs, and preserves resource-scoped sharing semantics when forking threads; [#13815](https://github.com/mastra-ai/mastra/pull/13815) — adds `createMastraCode({ omScope })` and disables async OM buffering when resource scope is active; [#13953](https://github.com/mastra-ai/mastra/pull/13953) — forwards image/file attachments into observer input and makes OM token counting attachment-aware; [#13996](https://github.com/mastra-ai/mastra/pull/13996) — restored typed filtering in `/om` model search for Kitty CSI-u terminal input sequences; [#14436](https://github.com/mastra-ai/mastra/pull/14436) — adds optional observer-generated thread titles that persist through OM metadata and Harness thread-title events; [#14437](https://github.com/mastra-ai/mastra/pull/14437) — adds OM retrieval/recall tooling with observation-group provenance, source-message pagination, and thread/resource scoped lookup; [#14567](https://github.com/mastra-ai/mastra/pull/14567) — expands recall into cross-thread resource browsing/search with strict scope access control, vector-backed observation-group indexing, and the `/thread` info command; [#14788](https://github.com/mastra-ai/mastra/pull/14788) — persists OM observation/reflection threshold changes to both thread metadata and global defaults so `/om` history-size changes survive restarts; [#14790](https://github.com/mastra-ai/mastra/pull/14790) — caps dynamically injected instruction reminders and explicitly tells OM not to observe those ephemeral reminders; [#14952](https://github.com/mastra-ai/mastra/pull/14952) — proxies server/Studio memory and observational-memory endpoints to the Mastra Gateway for `mastra/` model agents with a gateway key; [#15359](https://github.com/mastra-ai/mastra/pull/15359) — adds opt-in caveman-style OM compression, global/thread persistence for the toggle, and base-prompt guidance that compressed memories are storage-only.

## User-visible behavior

- What the user can do: use persistent observational memory across Mastra Code conversations/resources, configure thread-vs-resource scope before startup, control whether attachments are observed, change `/om` history-size thresholds and caveman-compression mode that survive restarts, search/select OM models in terminals such as Kitty, fork threads with relevant OM state preserved, let OM generate concise thread titles when enabled, let agents call `recall` to inspect exact source messages or semantically search same-resource memories across threads, and view gateway-backed memory status/history in Studio/server routes for `mastra/` agents.
- Success looks like: observations/reflections happen in the background without polluting chat or forgetting important context; optional caveman compression stores terse memories without changing assistant responses to the user; observer prompts get bounded previous-observation context instead of unbounded historical memory; pasted/uploaded images/files are represented for the observer without inflated counts; `/om` threshold and caveman changes restore from thread metadata and seed new threads from global defaults; dynamically loaded instruction reminders are not stored as observations; `/om` model search accepts printable typed input in Kitty/CSI-u terminals; forking a thread carries the relevant OM forward without mutating the source; generated titles update the thread record/status without overwriting with junk; recall can move from summarized observations to raw messages or older same-resource threads without crossing resource/thread boundaries accidentally; gateway memory endpoints return local-shaped records when a gateway key is configured.
- Must preserve: observer/reflector model settings, persisted thresholds, caveman mode, scope, retrieval scope, attachment filters, provider-aware token counting, previous-observation token budgets, activation/window-retention behavior, continuation hints, thread-title guards, message-ID remapping on clone, source-message provenance, cross-thread access guards, vector index freshness, gateway record conversion, dynamic-reminder exclusion, and loaded memory after restart.

## Entry points / commands

- Commands / shortcuts / flags: `/om` opens observer/reflector model, threshold, caveman mode, and attachment-observation settings; `/setup` chooses the default OM pack; `/thread` shows current thread identity/provenance; the agent-facing `recall` memory tool is registered when OM `retrieval` is enabled.
- Automatic triggers: memory factory attaches observational memory to agent runs; startup resolves global OM settings including persisted threshold/caveman defaults; thread load restores/backfills threshold and caveman metadata; OM events render progress/output; retrieval mode wraps observations in source-message ranges and indexes observation groups for later recall/search.

## TUI states

- Idle: `/om` modal edits observer, reflector, thresholds, caveman mode, attachment observation.
- Active / modal / error: OM markers/output can appear before the active streaming component; quiet mode suppresses buffering markers.

## Headless / non-TUI behavior

- Supported: same memory factory attaches to headless runs; `recall` is available as a regular memory tool when retrieval is configured.
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
| Observations/reflections | Memory storage + vector store when present; observer instruction excludes `dynamic-agents-md` reminders | Agent memory retrieval |
| Observer/reflector models | Harness request context + thread settings + settings | OM model functions, `/setup`, `/om`, `om_model_changed` subscribers, Codex OAuth remapping |
| Thresholds | Harness state + thread metadata + global settings `models.omObservationThreshold` / `omReflectionThreshold`; thread load restores saved metadata and backfills missing values from current state | Memory factory, `/om`, startup initial state |
| Caveman compression mode | Harness state `cavemanObservations` + thread metadata + global settings `models.omCavemanObservations`; `thread-caveman-state.ts` mirrors/seeds per-thread metadata on startup/thread changes | `getDynamicMemory()` observer/reflection instructions, `/om`, base prompt memory-style guidance |
| OM UI progress | Harness display state + transient TUI components | Chat/status rendering |
| OM modal model search input | `ModelSelectorComponent` / pi-tui input parsing; originally fixed for Kitty CSI-u search in #13996 | `/om` observer/reflector model pickers |
| OM scope | `createMastraCode({ omScope })` override, then `MASTRA_OM_SCOPE`, project/global `database.json`, then `thread` default | Memory factory, OM storage keying |
| Resource-scope buffering | `getDynamicMemory()` disables `bufferTokens`/`bufferActivation` when scope is `resource` | Core OM validation and activation behavior |
| Attachment observation | Harness state/thread setting/global setting `observeAttachments` + core attachment filter | Observer input, `/om` modal, TUI image/file submit path |
| Attachment token estimates | `TokenCounter` cache + provider token-count endpoints + client-stamped estimates | OM threshold checks, context budgeting, observer-window token count |
| Observer previous-context budget | `observation.previousObserverTokens` (`2000` default; `0` omit previous observations; `false` disables optimization) + `prepareObserverContext()` | Observer prompt construction, buffered-reflection replacement, prior metadata continuity hints |
| Buffer activation math | Core OM thresholds + storage `swapBufferedToActive()` | Runtime context trimming, async buffering, blockAfter fallback |
| Continuation hints | Observer output → buffered chunks / thread OM metadata | Next observer prompt, memory context injection, activation result |
| Observer-generated thread title | `observation.threadTitle` opt-in + parsed `<thread-title>` → chunk/thread OM metadata → storage `updateThread()` guarded by title length/change checks | Thread record title, Harness `om_thread_title_updated` event, TUI status/markers |
| Observation provenance groups | `wrapInObservationGroup()` ranges around observer output when retrieval is enabled | Observation context rendering, reflection provenance, recall cursor guidance |
| Recall/retrieval tool | `Memory.listTools()` registers `recallTool()` from OM `retrieval` config; `om-tools.ts` owns thread/resource scoping, cursor resolution, message/part formatting, cross-thread browsing, and vector search result rendering | Agents browsing past threads/messages, source-message lookup from observation groups |
| Observation search index | `Memory.indexObservation()` / `searchMessages()` + selected Mastra Code vector store + `index-messages.ts` backfill script | `recall` mode=`search`, same-resource cross-thread memory search, migration/backfill workflows |
| Gateway memory proxy | Server `GatewayMemoryClient` + `isGatewayAgentAsync()` + `MASTRA_GATEWAY_API_KEY`/URL env; converts gateway thread/message/OM records to local response shapes | Studio/server memory status, config, OM history, buffer-status polling, thread/message listing for `mastra/` agents |
| Cloned OM records | `Memory.cloneThread()` + storage OM domain | Thread/resource fork behavior, message-ID remapping, source-record preservation |

## Key files

- `mastracode/src/agents/memory.ts` — dynamic OM memory factory and Mastra Code defaults; current source reads persisted thresholds/caveman mode from harness state, sets observation `bufferActivation` to `2000` for thread scope, enables `threadTitle: true` for MC, disables async buffering for resource scope, passes `remapForCodexOAuth: true` for observer/reflector model resolution, instructs OM to ignore `dynamic-agents-md` system reminders, and conditionally adds caveman compression instructions for observers/reflections.
- `packages/memory/src/processors/observational-memory/thresholds.ts` — activation retention floor, `blockAfter` resolution, and chunk-boundary safeguards.
- `packages/memory/src/index.ts` — `cloneThread()` orchestration, OM clone rollback, message-ID remapping, resource-scope sharing, and xxhash thread-tag replacement.
- `packages/memory/src/processors/observational-memory/observational-memory.ts` — core OM runtime, mid-step activation decisions, `prepareObserverContext()` previous-observation budgeting (`previousObserverTokens`), attachment-aware token checks, retrieval-mode observation-group wrapping/rendering, context injection (`<current-task>` / `<suggested-response>`), and activated title persistence.
- `packages/memory/src/processors/observational-memory/observation-groups.ts` and `anchor-ids.ts` — durable observation-group XML/range provenance, reflection group rendering/reconciliation, and ephemeral ordinal anchors for observer prompts.
- `packages/memory/src/tools/om-tools.ts` — `recall` memory tool implementation for current/resource thread listing, semantic search, cursor/range hints, message pagination, high-detail part lookup, and thread/resource access guards.
- `packages/memory/src/scripts/index-messages.ts` — observation-group indexing/backfill utility for source-message ranges, cycle markers, duplicate hashes, and vector upsert reports.
- `packages/memory/src/processors/observational-memory/observer-runner.ts` — observer streaming call, request-context/abort propagation, attachment filter resolution, parsed continuation hints/thread title, and degenerate-output retry/failure.
- `packages/memory/src/processors/observational-memory/observer-agent.ts` — observer history formatting, prior thread metadata prompt hints, conditional `<thread-title>` output format, attachment placeholders, tool-result attachment extraction, and image/file observer input parts.
- `packages/memory/src/processors/observational-memory/token-counter.ts` — provider-aware image/file token estimation, provider count-token calls, remote image probing, and estimate caching.
- `packages/memory/src/processors/observational-memory/observation-strategies/async-buffer.ts` — buffered chunk persistence for continuation hints.
- `packages/memory/src/processors/observational-memory/observation-strategies/sync.ts` — sync observation persistence into thread OM metadata.
- `packages/core/src/harness/harness.ts` — OM stream chunk handling, OM failure aborts, observer/reflector model switch events, threshold restore/backfill on thread load, and `Harness.cloneThread()` dynamic memory path.
- `packages/core/src/storage/domains/memory/*` and store-backed memory domains — OM storage APIs used by clone/read/history/insert paths.
- `mastracode/src/tui/commands/om.ts` — `/om` settings modal wiring, including threshold/thread/global persistence, caveman-mode persistence, and observe-attachments persistence.
- `mastracode/src/agents/thread-caveman-state.ts` and `mastracode/src/schema.ts` — Mastra Code-owned per-thread OM setting restore/seed logic and harness-state schema for `cavemanObservations` / `observeAttachments`.
- `mastracode/src/tui/mastra-tui.ts` — pending pasted images, `[image]` placeholders, optimistic user messages, and Harness file/image signal dispatch.
- `mastracode/src/tui/handlers/om.ts`, `event-dispatch.ts`, and `components/om-marker.ts` — OM event rendering, including thread-title-updated markers/status refresh.
- `mastracode/src/tui/components/om-settings.ts` and `mastracode/src/tui/components/model-selector.ts` — settings UI and observer/reflector model search picker, including Kitty CSI-u typed filtering coverage.
- `mastracode/src/tui/key-input.ts` — current shared printable shortcut decoder for Kitty CSI-u / xterm modifyOtherKeys sequences.
- `mastracode/src/index.ts` — `MastraCodeConfig.omScope` startup override, global OM threshold initial state, memory/vector store wiring, and heartbeat setup.
- `mastracode/src/tui/commands/thread.ts` — `/thread` info display for active thread/resource/fork provenance.
- `mastracode/src/schema.ts`, `utils/project.ts`, and `utils/storage-factory.ts` — state schema, `getOmScope()` env/project/global/default precedence, and LibSQL/PG vector-store pairing for recall search.
- `packages/server/src/server/handlers/gateway-memory-client.ts` and `memory.ts` — Gateway Memory HTTP client, gateway-agent detection, local shape conversion, and server route proxy paths for memory/OM endpoints.

## Dependencies / related features

- [Interactive TUI chat](../tui/interactive-chat.md) — OM markers render around chat streaming.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — OM uses separate observer/reflector models; `mastra/` model routing and Memory Gateway credentials determine whether server routes proxy memory to the gateway.
- [Onboarding and global settings](../settings/onboarding-and-global-settings.md) — first-run setup selects default OM pack/model and settings store persisted OM threshold/caveman defaults.
- [Harness display state](../integrations/harness-display-state.md) — OM status/progress fields used by TUI rendering.
- [Persistent conversations](../threads/persistent-conversations.md) — OM scope/reload depends on resource/thread context, and OM-generated titles update thread metadata.
- [Resource ID switching](../threads/resource-id-switching.md) — resource changes determine whether resource-scoped OM is shared or cloned to a new resource.
- [Storage backend configuration](../settings/storage-backend.md) — selected storage/vector backend owns persisted observations and recall index.
- [File attachments in chat input](../chat/file-attachments.md) and [Clipboard paste](../tui/clipboard-paste.md) — attachments become message parts that OM may observe.
- [Prompt context and project instructions](../chat/prompt-context.md) — base prompt explains compressed caveman memories as storage-only and prevents response-style leakage.

## Existing tests

- `mastracode/src/tui/commands/__tests__/om.test.ts` — OM role override persistence behavior.
- `mastracode/src/tui/components/__tests__/om-settings.test.ts` — model picker behavior for OM settings, including Kitty CSI-u printable-key filtering.
- `mastracode/src/tui/__tests__/key-input.test.ts` — shared printable shortcut decoding for Kitty CSI-u and xterm modifyOtherKeys forms.
- `mastracode/src/tui/handlers/__tests__/om.test.ts` — OM marker rendering/quiet-mode behavior.
- `packages/memory/src/processors/observational-memory/__tests__/observational-memory.test.ts` — core activation, reflection, overshoot, retention behavior, blockAfter fallback, previous-observation truncation (`previousObserverTokens`), buffered-reflection replacement, observation-group/anchor helper coverage, prior metadata prompt hints, continuation-hint/thread-title parsing, most-recent activated chunk hint selection, observer attachment formatting, tool-result attachment extraction, image-heavy threshold checks, and buffered/sync thread-title persistence.
- `packages/memory/src/tools/om-tools.test.ts` — `recall` tool pagination, thread/resource scoping, cross-thread cursor browsing, search rendering, high-detail part lookup, cursor/range hints, and retrieval config registration.
- `mastracode/src/tui/commands/__tests__/thread.test.ts` — `/thread` current-thread, no-active-thread, missing-thread fallback, and fork provenance display.
- `packages/memory/src/processors/observational-memory/__tests__/token-counter.test.ts` — image/file token estimates, provider count-token endpoint fallback/caching/dedup, remote image probing, client-stamped estimates, and non-image file byte heuristics.
- `packages/memory/src/processors/observational-memory/__tests__/mid-loop-observation.test.ts` — mid-step observation/activation regressions, including async buffer activation without waiting for the next user turn.
- `packages/core/src/harness/om-failure-abort.test.ts`, `om-threshold-persistence.test.ts`, `get-om-record.test.ts` — core harness OM failure/abort, threshold restore/backfill persistence, and record behavior.
- `mastracode/src/agents/thread-caveman-state.test.ts` and `mastracode/src/__tests__/index.test.ts` — caveman/observe-attachments thread metadata mirror/seed behavior and startup restore wiring.
- `packages/memory/src/clone-thread-om.test.ts` — thread-scoped OM clone, resource-scoped sharing/new-resource clone, message-ID remapping, transient-flag reset, malformed fields, current-generation-only clone, and Harness dynamic-memory clone path.
- `packages/memory/src/processors/observational-memory/__tests__/abort-signal.test.ts` — observer/reflector abort-signal guard behavior.
- `mastracode/src/utils/__tests__/gateway-sync.test.ts` — related heartbeat gateway sync wrapper.
- `packages/core/src/agent/__tests__/memory-gateway-duck-typing.test.ts` — gateway model duck-typing does not lose memory integration during agent execution.

## Missing tests

- End-to-end observation/reflection across restart with resource/thread scope, including `currentTask` / `suggestedContinuation` continuity.
- `/om` modal model/attachment changes propagate to harness state, thread settings, settings file, and next memory factory instance; threshold propagation is covered by core restore/backfill tests but still lacks a direct Mastra Code command-level regression.
- Mastra Code-specific test that `getDynamicMemory()` wires intended OM activation defaults into core memory.
- Direct tests for `getOmScope()` precedence and `createMastraCode({ omScope: 'resource' })` producing a resource-scoped memory config with async buffering disabled.
- Mastra Code `/om` command test asserting observer/reflector model changes call `switchObserverModel()` / `switchReflectorModel()` rather than raw `setState()`, and caveman toggles write harness state, thread metadata, and global settings together.
- Full TUI/Harness test that pasted images are submitted as file parts and then observed according to `observeAttachments`.
- Agent-level integration test proving `recall` can use an observation-group range from injected OM context to recover exact source messages.
- Storage/vector integration test that fresh OM observations are indexed and `recall` mode=`search` returns same-resource cross-thread results across LibSQL and PostgreSQL vector backends.
- Server route integration tests for gateway-backed memory/OM endpoints (`GET_MEMORY_STATUS_ROUTE`, OM history, buffer-status polling, thread/message listing) with mocked Gateway Memory API responses.
- Storage-backed integration coverage for OM clone across LibSQL/Postgres/Mongo/MySQL/Redis adapters, especially rollback and resource-scope new-resource clones.

## Known risks / regressions

- Memory factory cache key must include every setting that changes behavior, including persisted threshold defaults and attachment-observation mode.
- State is split across harness state, settings, thread settings, storage, and display state; threshold and caveman writes must keep thread overrides and global defaults intentionally separate.
- Dynamic AGENTS.md reminders must not be observed into memory, even when their content is truncated and rendered in chat history.
- Caveman compression is only for memory storage: base prompt wording and tests must prevent terse observation style from leaking into normal user-facing responses.
- Core OM activation defaults can drift from Mastra Code defaults; PR #13305 intended `bufferActivation: 1000` / `blockAfter: 1.2`, PR #13349 temporarily raised observation `bufferActivation` to `4000`, and current Mastra Code wiring is `bufferActivation: 2000` / `blockAfter: 2` after later precision/scope changes.
- Resource scope intentionally disables async buffering; enabling it without core support can throw validation errors or mix resource-wide buffered state unexpectedly.
- Attachment filtering and token counting are provider-sensitive; wrong mime-type detection, stale client estimates, or failed provider count endpoints can change when OM activates.
- `previousObserverTokens` reduces observer prompt cost but can hide old low-priority observations from the observer; prior metadata and hidden-count markers must stay clear so continuity does not regress.
- Storage adapters must keep activation-boundary math in sync; in-memory, LibSQL, MongoDB, and PG each implement `swapBufferedToActive()`.
- Continuation hints are intentionally taken from the most recent activated chunk only; stale older hints must not leak forward after partial activation.
- OM observer/reflector model resolution must preserve requestContext so Codex OAuth remapping, reasoning effort, and gateway headers survive the memory pipeline.
- Clone must remap only messages included in `messageIdMap`; dropped source IDs must not leak into cloned OM. If OM clone fails after storage cloned the thread, rollback must delete the clone before vector embedding starts.
- Recall access guards must stay strict: resource-scoped recall can browse same-resource threads, but thread-scoped recall must reject cross-thread cursors and `threadId` values outside the active resource.
- Recall search depends on observation-group vector metadata (`resource_id`, `thread_id`, `group_id`, range, observed_at); stale/missing backfill can make search look empty even when raw message pagination still works.
- Gateway memory proxy detection uses `mastra/` model identity and gateway env/key availability; if either drifts, Studio/server routes can silently fall back to local/no-memory behavior.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
