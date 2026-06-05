# Core Harness API and reference docs

## Origin PR / commit

- PR: [#13353](https://github.com/mastra-ai/mastra/pull/13353) — changed public `Harness` methods to object-parameter calls and added the first Harness class reference page.
- Later changes: [#13427](https://github.com/mastra-ai/mastra/pull/13427) — added `HarnessDisplayState`, `getDisplayState()`, `display_state_changed`, and `subscribeDisplayState()` for UI-agnostic rendering; [#13457](https://github.com/mastra-ai/mastra/pull/13457) — added/corrected workspace lifecycle methods and dynamic workspace caching; [#13519](https://github.com/mastra-ai/mastra/pull/13519) — initialized an internal Mastra instance from Harness storage so standalone-agent tool approvals can resume; [#13525](https://github.com/mastra-ai/mastra/pull/13525) — moved Mastra Code docs to the Code docs site and marked Harness reference docs as Alpha; [#13716](https://github.com/mastra-ai/mastra/pull/13716) — exposes Mastra Code `resolveModel` from `createMastraCode()` for external UI consumers; [#14433](https://github.com/mastra-ai/mastra/pull/14433) — forwards Harness thread/resource identity into model request headers during core LLM execution; [#15036](https://github.com/mastra-ai/mastra/pull/15036) — adds Harness-level browser storage and propagation to mode agents; [#13891](https://github.com/mastra-ai/mastra/pull/13891) — lets `createMastraCode()` callers override the memory instance/factory passed into Harness.

## User-visible behavior

- What the user can do: Mastra Code and external Harness consumers call stable, named-parameter methods such as `switchMode({ modeId })`, `sendMessage({ content })`, `switchThread({ threadId })`, `respondToQuestion({ questionId, answer })`, and `resolveWorkspace()`; external `createMastraCode()` consumers can also resolve model IDs through the same configured resolver as the TUI and supply a custom Harness memory instance/factory for non-default model providers.
- Success looks like: TUI/headless behavior is unchanged, while call sites are easier to read and safer to extend; UI consumers can subscribe to display-state snapshots instead of raw-event state machines; workspace consumers can eagerly resolve dynamic workspaces; standalone Harness agents with storage can persist and resume approval snapshots; model execution can attach `x-thread-id`/`x-resource-id` without each caller hand-wiring headers.
- Must preserve: method names, parameter object shapes, docs examples, TUI/headless call-site parity, display-state contract, thread/model/mode behavior, and internal Mastra registration for storage-backed agents.

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
| Prompt/tool/plan resolver state | Core Harness pending resolver maps | TUI prompt/tool handlers, headless auto-resolvers |
| Public API docs | `docs/src/content/en/reference/harness/harness-class.mdx` | External Harness consumers |
| Display projection | `HarnessDisplayState` | TUI and external UI consumers |
| Workspace instance/cache | Core Harness workspace fields/factory | Slash commands, agents, workspace tools, external consumers |
| Browser instance/factory | Core Harness browser fields/factory + `setBrowser()` propagation | Mode agents, browser automation tools/context, external consumers |
| Memory instance/factory override | `MastraCodeConfig.memory` or default `getDynamicMemory(storage, vectorStore)` | External `createMastraCode()` consumers, Harness memory/recall/OM pipeline |
| Internal Mastra/storage registration | Core Harness `init()` / `getMastra()` | Standalone agents, approval/suspend resume, workflow snapshots |
| Model request identity headers | Core LLM execution `_internal.threadId` / `_internal.resourceId` merged with model/modelSettings headers | Memory Gateway, provider requests, server-side memory enrichment |
| Harness docs location | Docs reference sidebar + Code docs redirects | External Harness consumers and Mastra Code docs readers |

## Key files

- `packages/core/src/harness/harness.ts` — current object-param public method implementation, display state, workspace/browser cache methods, browser propagation to mode agents, and internal Mastra registration for storage-backed standalone agents.
- `packages/core/src/harness/types.ts` — request context, display state, workspace config, and Harness types exposed to built-in tools/consumers.
- `packages/core/src/harness/display-state-scheduler.ts` — coalesced display-state subscriber snapshots.
- `packages/core/src/harness/tools.ts` — built-in tool callers using object-param Harness methods.
- `packages/core/src/workflows/default.ts` and `packages/core/src/workflows/entry.ts` — serialize JSON-safe request context for persisted resume snapshots.
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts` — model execution merges memory identity headers, model config headers, and call-time `modelSettings.headers`.
- `mastracode/src/tui/setup.ts` — keyboard/mode/thread call sites.
- `mastracode/src/tui/handlers/prompts.ts` — question and plan approval call sites.
- `mastracode/src/tui/handlers/tool.ts` — tool approval call sites.
- `mastracode/src/headless.ts` — non-TUI call sites.
- `mastracode/src/index.ts` — exports `resolveModel`, accepts `MastraCodeConfig.memory`, and passes either the override or default dynamic memory into Harness from `createMastraCode()`.
- `docs/src/content/en/reference/harness/harness-class.mdx` — Alpha-badged reference page and examples for the public Harness class.
- `docs/vercel.json` — redirects old main-site Mastra Code docs URLs to `https://code.mastra.ai/`.

## Dependencies / related features

- [Harness display state](./harness-display-state.md) — UI-agnostic display-state API added after the object-param refactor.
- [Browser automation](./browser-automation.md) — Harness-level browser instances are propagated to agents.
- [Observational memory](../memory/observational-memory.md) — memory overrides replace Mastra Code's default dynamic OM/recall memory factory.
- [Skills command and workspace resolution](./skills-command.md) — `/skills` relies on dynamic workspace resolution and caching.
- [Interactive TUI chat](../tui/interactive-chat.md) — live event projection depends on Harness methods.
- [Persistent conversations](../threads/persistent-conversations.md) — thread APIs are part of this surface.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — mode/model APIs are part of this surface.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — approval APIs and persisted approval resume are part of this surface.

## Existing tests

- `packages/core/src/harness/thread-locking.test.ts` — verifies object-param `createThread({ ... })` / `switchThread({ threadId })` behavior while preserving locking semantics.
- `packages/core/src/harness/display-state.test.ts` — verifies `HarnessDisplayState`, `display_state_changed`, and `subscribeDisplayState()` behavior.
- `packages/core/src/harness/workspace-resolution.test.ts` — verifies `getWorkspace()`, `resolveWorkspace()`, `hasWorkspace()`, and dynamic workspace caching.
- `packages/core/src/agent/__tests__/tool-approval-standalone-repro.test.ts` and `mastracode/src/__tests__/tool-approval-libsql.test.ts` — verify approval resume with stored workflow snapshots and standalone/storage-backed agents.
- `packages/core/src/workflows/default.test.ts` — verifies `serializeRequestContext()` skips functions, circular objects, and RPC-like proxies before persistence.
- `packages/core/src/harness/v1/mode.test.ts` — verifies current `listModes()` behavior in the v1 Harness surface.
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.test.ts` — verifies model header merge order and automatic `x-thread-id`/`x-resource-id` request headers.
- `packages/core/src/agent/__tests__/browser.test.ts` — verifies browser propagation into Agent execution context and thread-aware browser sessions.
- `mastracode/src/__tests__/index.test.ts` — verifies default dynamic memory is passed into Harness and covers adjacent `createMastraCode()` runtime wiring.
- `mastracode/src/tui/__tests__/*`, `mastracode/src/tui/handlers/__tests__/*`, and command tests indirectly compile/run the migrated TUI call sites.
- `mastracode/src/headless.test.ts` indirectly covers migrated non-TUI call sites.

## Missing tests

- API compatibility/type smoke that imports `@mastra/core/harness` and exercises the documented object-param examples.
- Direct `createMastraCode({ memory })` test proving a caller-supplied memory instance/factory replaces the default dynamic memory.
- Docs example compile check for `docs/src/content/en/reference/harness/harness-class.mdx` snippets.
- Redirect smoke test for removed Mastra Code docs paths, if the docs site does not already cover `docs/vercel.json` redirects.
- Negative test proving old positional call shapes are intentionally unsupported, if that break is expected.

## Known risks / regressions

- Old positional consumer code will fail if not migrated; no compatibility shim was verified.
- Docs and implementation can drift because reference examples are not clearly compiled as tests.
- Standalone Harness users can regress approval/suspend resume if agents lose internal Mastra registration or request context serialization reintroduces live runtime objects.
- TUI/headless behavior can regress if future refactors update one set of object-param call sites but not the other.
- Model request header ownership is shared with model/provider configuration; duplicate keys intentionally let `modelSettings.headers` override model config and memory headers, so callers can accidentally shadow `x-thread-id`/`x-resource-id`.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
