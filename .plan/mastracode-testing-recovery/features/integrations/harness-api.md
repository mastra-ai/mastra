# Core Harness API and reference docs

## Origin PR / commit

- PR: [#13353](https://github.com/mastra-ai/mastra/pull/13353) — changed public `Harness` methods to object-parameter calls and added the first Harness class reference page.
- Later changes: [#13427](https://github.com/mastra-ai/mastra/pull/13427) — added `HarnessDisplayState`, `getDisplayState()`, `display_state_changed`, and `subscribeDisplayState()` for UI-agnostic rendering; [#13457](https://github.com/mastra-ai/mastra/pull/13457) — added/corrected workspace lifecycle methods and dynamic workspace caching.

## User-visible behavior

- What the user can do: Mastra Code and external Harness consumers call stable, named-parameter methods such as `switchMode({ modeId })`, `sendMessage({ content })`, `switchThread({ threadId })`, `respondToQuestion({ questionId, answer })`, and `resolveWorkspace()`.
- Success looks like: TUI/headless behavior is unchanged, while call sites are easier to read and safer to extend; UI consumers can subscribe to display-state snapshots instead of raw-event state machines; workspace consumers can eagerly resolve dynamic workspaces.
- Must preserve: method names, parameter object shapes, docs examples, TUI/headless call-site parity, display-state contract, and thread/model/mode behavior.

## Entry points / commands

- Commands / shortcuts / flags: no direct slash command; this is the API surface used by Mastra Code commands, keyboard handlers, headless flags, and interactive prompt/tool handlers.
- Automatic triggers: every run path that calls Harness methods (`init`, thread selection, mode/model switching, signals/messages, prompt answers, plan approvals, tool approvals).

## TUI states

- Idle: mode/model/thread selectors call object-param Harness APIs.
- Active / modal / error: inline questions, plan approval, tool approval, queued signals, and thread switching call object-param Harness APIs.

## Headless / non-TUI behavior

- Supported: `headless.ts` uses the same object-param APIs for question/tool/plan responses, model listing, thread switching, and message sends.
- Not supported / unknown: no standalone runtime compatibility shim for old positional calls was verified.

## Streaming / loading / interrupted states

- Streaming / loading: live prompts and tool approvals resolve via `respondToQuestion({ ... })`, `respondToPlanApproval({ ... })`, and `respondToToolApproval({ ... })` while streams are active or suspended.
- Abort / retry / resume: thread/mode switches and plan approval still rely on Harness abort/idle sequencing; this PR changed call shape, not lifecycle semantics.

## Streaming vs loaded-from-history behavior

- While actively streaming: TUI/headless code uses Harness method calls to mutate live session/runtime state.
- After reload / history reconstruction: stored messages/thread metadata are loaded by Harness; object-param API shape does not change persisted history format.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Harness mode/model/thread state | `packages/core/src/harness/harness.ts` | Mastra Code TUI/headless, commands, docs consumers |
| Prompt/tool/plan resolver state | Core Harness pending resolver maps | TUI prompt/tool handlers, headless auto-resolvers |
| Public API docs | `docs/src/content/en/reference/harness/harness-class.mdx` | External Harness consumers |
| Display projection | `HarnessDisplayState` | TUI and external UI consumers |
| Workspace instance/cache | Core Harness workspace fields/factory | Slash commands, agents, workspace tools, external consumers |

## Key files

- `packages/core/src/harness/harness.ts` — current object-param public method implementation, display state, and workspace cache methods.
- `packages/core/src/harness/types.ts` — request context, display state, workspace config, and Harness types exposed to built-in tools/consumers.
- `packages/core/src/harness/display-state-scheduler.ts` — coalesced display-state subscriber snapshots.
- `packages/core/src/harness/tools.ts` — built-in tool callers using object-param Harness methods.
- `mastracode/src/tui/setup.ts` — keyboard/mode/thread call sites.
- `mastracode/src/tui/handlers/prompts.ts` — question and plan approval call sites.
- `mastracode/src/tui/handlers/tool.ts` — tool approval call sites.
- `mastracode/src/headless.ts` — non-TUI call sites.
- `docs/src/content/en/reference/harness/harness-class.mdx` — reference page and examples for the public Harness class.

## Dependencies / related features

- [Harness display state](./harness-display-state.md) — UI-agnostic display-state API added after the object-param refactor.
- [Skills command and workspace resolution](./skills-command.md) — `/skills` relies on dynamic workspace resolution and caching.
- [Interactive TUI chat](../tui/interactive-chat.md) — live event projection depends on Harness methods.
- [Persistent conversations](../threads/persistent-conversations.md) — thread APIs are part of this surface.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — mode/model APIs are part of this surface.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — approval APIs are part of this surface.

## Existing tests

- `packages/core/src/harness/thread-locking.test.ts` — verifies object-param `createThread({ ... })` / `switchThread({ threadId })` behavior while preserving locking semantics.
- `packages/core/src/harness/display-state.test.ts` — verifies `HarnessDisplayState`, `display_state_changed`, and `subscribeDisplayState()` behavior.
- `packages/core/src/harness/workspace-resolution.test.ts` — verifies `getWorkspace()`, `resolveWorkspace()`, `hasWorkspace()`, and dynamic workspace caching.
- `packages/core/src/harness/v1/mode.test.ts` — verifies current `listModes()` behavior in the v1 Harness surface.
- `mastracode/src/tui/__tests__/*`, `mastracode/src/tui/handlers/__tests__/*`, and command tests indirectly compile/run the migrated TUI call sites.
- `mastracode/src/headless.test.ts` indirectly covers migrated non-TUI call sites.

## Missing tests

- API compatibility/type smoke that imports `@mastra/core/harness` and exercises the documented object-param examples.
- Docs example compile check for `docs/src/content/en/reference/harness/harness-class.mdx` snippets.
- Negative test proving old positional call shapes are intentionally unsupported, if that break is expected.

## Known risks / regressions

- Old positional consumer code will fail if not migrated; no compatibility shim was verified.
- Docs and implementation can drift because reference examples are not clearly compiled as tests.
- TUI/headless behavior can regress if future refactors update one set of object-param call sites but not the other.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
