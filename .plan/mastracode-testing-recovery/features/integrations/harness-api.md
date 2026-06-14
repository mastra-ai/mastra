# Core Harness API and reference docs

## Origin PR / commit

- PR: [#13353](https://github.com/mastra-ai/mastra/pull/13353) — changed public `Harness` methods to object-parameter calls and added the first Harness class reference page.
- Later changes: [#13427](https://github.com/mastra-ai/mastra/pull/13427) — added `HarnessDisplayState`, `getDisplayState()`, `display_state_changed`, and `subscribeDisplayState()` for UI-agnostic rendering; [#13457](https://github.com/mastra-ai/mastra/pull/13457) — added/corrected workspace lifecycle methods and dynamic workspace caching; [#13519](https://github.com/mastra-ai/mastra/pull/13519) — initialized an internal Mastra instance from Harness storage so standalone-agent tool approvals can resume; [#13525](https://github.com/mastra-ai/mastra/pull/13525) — moved Mastra Code docs to the Code docs site and marked Harness reference docs as Alpha; [#13716](https://github.com/mastra-ai/mastra/pull/13716) — exposes Mastra Code `resolveModel` from `createMastraCode()` for external UI consumers; [#14433](https://github.com/mastra-ai/mastra/pull/14433) — forwards Harness thread/resource identity into model request headers during core LLM execution; [#15036](https://github.com/mastra-ai/mastra/pull/15036) — adds Harness-level browser storage and propagation to mode agents; [#13891](https://github.com/mastra-ai/mastra/pull/13891) — lets `createMastraCode()` callers override the memory instance/factory passed into Harness; [#16340](https://github.com/mastra-ai/mastra/pull/16340) — hardens plan-approval resolver ordering and clears stale abort state before subsequent message/signal runs; [#16231](https://github.com/mastra-ai/mastra/pull/16231) — adds Agent signal sending, persisted signal message conversion, thread subscriptions, and active-run follow-up draining; [#16521](https://github.com/mastra-ai/mastra/pull/16521) — routes regular plan approval through structured `sendSignal()` after plan approval resolution so the Build-mode run starts without duplicate reminders or hangs; [#16665](https://github.com/mastra-ai/mastra/pull/16665) — routes agent thread subscriptions and signal coordination through injectable PubSub instances instead of process-local runtime state; [#16669](https://github.com/mastra-ai/mastra/pull/16669) — adds Mastra Code's Unix socket PubSub transport for cross-process signal coordination; [#16923](https://github.com/mastra-ai/mastra/pull/16923) — resolves active/idle signal delivery attributes before persistence; [#16939](https://github.com/mastra-ai/mastra/pull/16939) — moves Unix socket signal routing to one socket per thread to prevent cross-thread serialization overhead; [#13751](https://github.com/mastra-ai/mastra/pull/13751) — adds `configDir` to `createMastraCode()` and keeps it typed in `MastraCodeState`; [#17070](https://github.com/mastra-ai/mastra/pull/17070) — tightens `MastraCodeConfig` generics around `MastraCodeState` for modes/workspace/memory/browser; [#17276](https://github.com/mastra-ai/mastra/pull/17276) — adds scoped Harness v1 session owner IDs and deterministic Mastra Code owner/session IDs for persisted thread/session records; [#17241](https://github.com/mastra-ai/mastra/pull/17241) — adds the experimental Agent notification signal API; [#17411](https://github.com/mastra-ai/mastra/pull/17411) — composes Harness v1 session state into the legacy Mastra Code state facade; [#17511](https://github.com/mastra-ai/mastra/pull/17511) — falls back to legacy `switchMode()` when no Harness v1 session is active.

## User-visible behavior

- What the user can do: Mastra Code and external Harness consumers call stable, named-parameter methods such as `switchMode({ modeId })`, `sendMessage({ content })`, `switchThread({ threadId })`, `respondToQuestion({ questionId, answer })`, and `resolveWorkspace()`; external `createMastraCode()` consumers can also resolve model IDs through the same configured resolver as the TUI, supply a custom Harness memory instance/factory for non-default model providers, choose a safe custom config directory, rely on scoped Harness v1 session ownership, and use notification signal APIs when storage supports them.
- Success looks like: TUI/headless behavior is unchanged, while call sites are easier to read and safer to extend; UI consumers can subscribe to display-state snapshots instead of raw-event state machines; workspace consumers can eagerly resolve dynamic workspaces; standalone Harness agents with storage can persist and resume approval snapshots; model execution can attach `x-thread-id`/`x-resource-id` without each caller hand-wiring headers; cross-runtime/thread subscriptions use the configured PubSub or per-thread Unix socket transport rather than one process's local maps; active/idle signal sends persist delivery attributes for history rendering; notification sends resolve policy against thread activity; Harness v1 sessions carry stable owner IDs and composed state through fresh, loaded, and cloned records; mode switching still works before a v1 session is active.
- Must preserve: method names, parameter object shapes, docs examples, TUI/headless call-site parity, display-state contract, thread/model/mode behavior, deterministic session identity, owner ID propagation, and internal Mastra registration for storage-backed agents.

## Entry points / commands

- Commands / shortcuts / flags: no direct slash command; this is the API surface used by Mastra Code commands, keyboard handlers, headless flags, and interactive prompt/tool handlers.
- Automatic triggers: every run path that calls Harness methods (`init`, thread selection, mode/model switching, signals/messages, prompt answers, plan approvals, tool approvals). `init()` also wires storage-backed Harness agents into the internal Mastra instance used for workflow snapshot resume.

## TUI states

- Idle: mode/model/thread selectors call object-param Harness APIs.
- Active / modal / error: inline questions, plan approval, tool approval, queued signals, and thread switching call object-param Harness APIs.

## Headless / non-TUI behavior

- Supported: `headless.ts` uses the same object-param APIs for question/tool/plan responses, model listing, thread switching, and message sends.
- Not supported / unknown: no standalone runtime compatibility shim for old positional calls was verified.

## Streaming / loading / interrupted states

- Streaming / loading: live prompts and tool approvals resolve via `respondToQuestion({ ... })`, `respondToPlanApproval({ ... })`, and `respondToToolApproval({ ... })` while streams are active or suspended.
- Abort / retry / resume: thread/mode switches and plan approval still rely on Harness abort/idle sequencing; tool approval resume depends on workflow snapshots persisted through the Harness-owned Mastra/storage path.

## Streaming vs loaded-from-history behavior

- While actively streaming: TUI/headless code uses Harness method calls to mutate live session/runtime state.
- After reload / history reconstruction: stored messages/thread metadata are loaded by Harness; object-param API shape does not change persisted history format.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Harness mode/model/thread state | `packages/core/src/harness/harness.ts` + Mastra Code model resolver | Mastra Code TUI/headless, commands, docs consumers, external `createMastraCode()` consumers |
| Prompt/tool/plan resolver state | Core Harness pending resolver maps; plan approvals resolve before aborting/switching modes | TUI prompt/tool handlers, headless auto-resolvers |
| Public API docs | `docs/src/content/en/reference/harness/harness-class.mdx` | External Harness consumers |
| Display projection | `HarnessDisplayState` | TUI and external UI consumers |
| Workspace instance/cache | Core Harness workspace fields/factory | Slash commands, agents, workspace tools, external consumers |
| Browser instance/factory | Core Harness browser fields/factory + `setBrowser()` propagation | Mode agents, browser automation tools/context, external consumers |
| Memory/config overrides | typed `MastraCodeConfig` fields for memory, modes, workspace, browser, PubSub, and `configDir` | External `createMastraCode()` consumers, Harness memory/recall/OM pipeline, config path loaders |
| Internal Mastra/storage registration | Core Harness `init()` / `getMastra()` | Standalone agents, approval/suspend resume, workflow snapshots |
| Model request identity headers | Core LLM execution `_internal.threadId` / `_internal.resourceId` merged with model/modelSettings headers | Memory Gateway, provider requests, server-side memory enrichment |
| Run abort/tracing state | Harness `abortController` / `abortRequested` plus per-run tracing context/options | Message sends, signals, follow-up queue, plan→goal handoff runs |
| Plan approval handoff signal | TUI prompt handler calls `respondToPlanApproval()` then Harness `sendSignal({ type: 'system-reminder' })` | regular approve → Build-mode execution without legacy XML/double render |
| Agent signals | `packages/core/src/agent/signals.ts` + Harness send/subscribe paths + `AgentThreadStreamRuntime` scoped by PubSub | active-run follow-ups, active/idle delivery attributes, reactive/system-reminder signals, persisted signal history, React SDK/Playground subscriptions, cross-runtime stream broadcasting |
| Mastra Code signal PubSub | `MastraCodeConfig.pubsub` / `unixSocketPubSub` / `crossProcessPubSub` resolved in `createMastraCode()` | Harness PubSub injection, per-thread cross-process signal delivery, file thread-lock disabling only when cross-process PubSub is active |
| Harness v1 session ownership | `HarnessConfig.ownerId`, `SessionRecord.ownerId`, deterministic `sess-${sha256(resourceId\0threadId).slice(0,32)}` IDs, and Mastra Code `mastracode-${sha256(hostname\0projectPath).slice(0,32)}` owner IDs | session creation/loading/cloning, in-memory harness storage, Mastra Code thread/session prefill, `/threads` switching |
| Harness v1 session state composition | `Session.getState()` / `Session.setState()` plus `HarnessCompat.getState()` / `setState()` facade | prompt context, tools, mode/model state, thread switching, legacy compatibility |
| Agent notification signals | `Agent.sendNotificationSignal()` + notifications storage domain and delivery policy | notification inbox, GitHub Signals, TUI notification rendering |
| Legacy mode fallback | `HarnessCompat.switchMode()` falls back to legacy switching when no active v1 session exists | startup/no-session mode changes and compatibility paths |
| Harness docs location | Docs reference sidebar + Code docs redirects | External Harness consumers and Mastra Code docs readers |

## Key files

- `packages/core/src/harness/harness.ts` — current object-param public method implementation, display state, signal/message send paths, follow-up queue draining, structured plan-approval wake-up support, PubSub propagation to mode agents, workspace/browser cache methods, browser propagation to mode agents, and internal Mastra registration for storage-backed standalone agents.
- `packages/core/src/harness/types.ts` — request context, display state, signal option shapes, workspace config, and Harness types exposed to built-in tools/consumers.
- `packages/core/src/agent/signals.ts` — Agent signal object, active/idle delivery attribute resolution, DB/LLM/data-part conversions, and XML marker wrapping.
- `packages/core/src/agent/thread-stream-runtime.ts` and `agent.ts` — PubSub-scoped thread runtime state, run registration/stream-part/signal events, agent PubSub inheritance from Mastra/Harness, and public state/notification signal APIs.
- `mastracode/src/utils/signals-pubsub.ts` — per-thread Unix socket PubSub factory used by Mastra Code when Unix socket signals are enabled.
- `packages/core/src/harness/display-state-scheduler.ts` — coalesced display-state subscriber snapshots.
- `packages/core/src/harness/mode-model-persistence.test.ts` and `tracing-propagation.test.ts` — plan approval resolver ordering and stale abort/tracing propagation regressions.
- `packages/core/src/harness/tools.ts` — built-in tool callers using object-param Harness methods.
- `packages/core/src/workflows/default.ts` and `packages/core/src/workflows/entry.ts` — serialize JSON-safe request context for persisted resume snapshots.
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts` — model execution merges memory identity headers, model config headers, and call-time `modelSettings.headers`.
- `mastracode/src/tui/setup.ts` — keyboard/mode/thread call sites.
- `mastracode/src/tui/handlers/prompts.ts` — question and plan approval call sites.
- `mastracode/src/tui/handlers/tool.ts` — tool approval call sites.
- `mastracode/src/headless.ts` — non-TUI call sites.
- `mastracode/src/index.ts` — exports `resolveModel`, accepts typed `MastraCodeConfig` overrides including `memory` and `configDir`, derives a stable Mastra Code owner ID from hostname + project path, pre-fills deterministic Harness v1 sessions from existing memory threads, wires optional GitHub Signals, and passes either the override or default dynamic memory into Harness from `createMastraCode()`.
- `mastracode/src/HarnessCompat.ts` — composes legacy state with active Harness v1 session state, model, and mode; delegates session/thread calls; falls back to legacy `switchMode()` without an active v1 session.
- `packages/core/src/harness/v1/harness.ts`, `session.ts`, and storage `domains/harness/*` — Harness v1 session creation/loading/cloning, owner ID propagation, composed state validation/events, deterministic thread/resource session IDs, and cloned immutable session records.
- `packages/core/src/notifications/*` — notification signal API dependencies for Agent/Harness consumers.
- `docs/src/content/en/reference/harness/harness-class.mdx` — Alpha-badged reference page and examples for the public Harness class.
- `docs/vercel.json` — redirects old main-site Mastra Code docs URLs to `https://code.mastra.ai/`.

## Dependencies / related features

- [Harness display state](./harness-display-state.md) — UI-agnostic display-state API added after the object-param refactor.
- [Browser automation](./browser-automation.md) — Harness-level browser instances are propagated to agents.
- [Observational memory](../memory/observational-memory.md) — memory overrides replace Mastra Code's default dynamic OM/recall memory factory.
- [Skills command and workspace resolution](./skills-command.md) — `/skills` relies on dynamic workspace resolution and caching.
- [Agent signals and streaming follow-ups](../chat/agent-signals.md) — Harness signal APIs power active-run follow-ups.
- [Notification inbox signals](../chat/notification-inbox-signals.md) — Agent notification APIs build on signal delivery and storage-backed records.
- [Interactive TUI chat](../tui/interactive-chat.md) — live event projection depends on Harness methods.
- [Persistent conversations](../threads/persistent-conversations.md) — thread/session APIs are part of this surface.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — mode/model APIs are part of this surface.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — approval APIs and persisted approval resume are part of this surface.

## Existing tests

- `packages/core/src/harness/thread-locking.test.ts` — verifies object-param `createThread({ ... })` / `switchThread({ threadId })` behavior while preserving locking semantics.
- `packages/core/src/harness/display-state.test.ts` — verifies `HarnessDisplayState`, `display_state_changed`, and `subscribeDisplayState()` behavior.
- `packages/core/src/harness/workspace-resolution.test.ts` — verifies `getWorkspace()`, `resolveWorkspace()`, `hasWorkspace()`, and dynamic workspace caching.
- `packages/core/src/agent/__tests__/tool-approval-standalone-repro.test.ts` and `mastracode/src/__tests__/tool-approval-libsql.test.ts` — verify approval resume with stored workflow snapshots and standalone/storage-backed agents.
- `packages/core/src/workflows/default.test.ts` — verifies `serializeRequestContext()` skips functions, circular objects, and RPC-like proxies before persistence.
- `packages/core/src/harness/v1/mode.test.ts`, `session.test.ts`, and `packages/core/src/storage/domains/harness/inmemory.test.ts` — verify current `listModes()` behavior, owner ID propagation, deterministic session records, composed state validation/events, clone/load behavior, and in-memory record cloning in the v1 Harness surface.
- `packages/core/src/harness/harness-public-api.test.ts` — compiles the Harness reference page's first TypeScript usage example through the published `@mastra/core/harness` export, then appends representative object-parameter calls for mode/model/thread/question/plan/tool APIs.
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.test.ts` — verifies model header merge order and automatic `x-thread-id`/`x-resource-id` request headers.
- `packages/core/src/agent/__tests__/browser.test.ts` — verifies browser propagation into Agent execution context and thread-aware browser sessions.
- `mastracode/src/HarnessCompat.test.ts` — verifies composed state, session/model/mode delegation, clone/list thread metadata, and legacy `switchMode()` fallback.
- `mastracode/src/__tests__/index.test.ts` — verifies default dynamic memory is passed into Harness, caller-supplied memory plus `configDir` override wiring, explicit-vs-Unix PubSub selection, cross-process PubSub validation/thread-lock behavior, GitHubSignals processor wiring, and adjacent `createMastraCode()` runtime wiring.
- `mastracode/scripts/mc-e2e/scenarios/harness-api-config.ts` — launches a custom `createMastraCode()` entrypoint through the real PTY TUI and verifies caller `configDir` loads custom commands, conflicting `initialState.configDir` cannot override the configured directory, and caller `initialState.yolo=false` reaches `/yolo`.
- `packages/core/src/events/__tests__/unix-socket-pubsub.test.ts` and `mastracode/src/utils/__tests__/signals-pubsub.test.ts` — verify Unix socket broker election, fan-out, backpressure, stale socket recovery, and per-thread socket path routing.
- `mastracode/src/tui/__tests__/*`, `mastracode/src/tui/handlers/__tests__/*`, and command tests indirectly compile/run the migrated TUI call sites.
- `mastracode/src/headless.test.ts` indirectly covers migrated non-TUI call sites.

## Missing tests

- Covered: `harness-api-config` covers caller `createMastraCode()` `configDir`/`initialState` state reaching the real TUI, with break validations for ignored `configDir`, `initialState.configDir` override ordering, and dropped `initialState` passthrough.
- Covered: `harness-public-api.test.ts` compiles the live Harness reference docs snippet and representative object-parameter API calls through the public package export.
- Deferred: redirect smoke test for removed Mastra Code docs paths, if the docs site does not already cover `docs/vercel.json` redirects.
- Deferred: negative test proving old positional call shapes are intentionally unsupported, if that break is expected.

## Known risks / regressions

- Old positional consumer code will fail if not migrated; no compatibility shim was verified.
- Docs and implementation can drift if future reference examples are added without extending the compile smoke.
- Standalone Harness users can regress approval/suspend resume if agents lose internal Mastra registration or request context serialization reintroduces live runtime objects.
- TUI/headless behavior can regress if future refactors update one set of object-param call sites but not the other.
- Harness v1 state composition can regress by splitting mode/model/session state from legacy prompt/tool state again; keep `HarnessCompat.getState()` and `setState()` tests focused.
- Model request header ownership is shared with model/provider configuration; duplicate keys intentionally let `modelSettings.headers` override model config and memory headers, so callers can accidentally shadow `x-thread-id`/`x-resource-id`.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
