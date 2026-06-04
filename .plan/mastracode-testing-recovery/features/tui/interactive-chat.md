# Interactive TUI chat

## Origin PR / commit

- PR: [#13218](https://github.com/mastra-ai/mastra/pull/13218) — initial TUI chat, streaming render, keyboard input, tool render, harness event dispatch.
- Later changes: [#13245](https://github.com/mastra-ai/mastra/pull/13245) — replaced the local prototype harness with core Harness events and interactive prompt primitives; [#13255](https://github.com/mastra-ai/mastra/pull/13255) — added the public `mastracode/tui` package export; [#13345](https://github.com/mastra-ai/mastra/pull/13345) — fixed Ctrl+F queued slash-command/autocomplete behavior; [#13350](https://github.com/mastra-ai/mastra/pull/13350) — extracted shared `TUIState` / `createTUIState()`; [#13413](https://github.com/mastra-ai/mastra/pull/13413) — split the large TUI class into setup, event-dispatch, handlers, status-line, shell, and history-render modules without changing user-facing chat behavior; [#13422](https://github.com/mastra-ai/mastra/pull/13422) — added the responsive startup banner above the chat layout; [#13426](https://github.com/mastra-ai/mastra/pull/13426) — simplified the startup command hint and `/help` reference; [#13427](https://github.com/mastra-ai/mastra/pull/13427) — added core `HarnessDisplayState` and centralized status-line refresh through `display_state_changed`; [#13456](https://github.com/mastra-ai/mastra/pull/13456) — refreshes and abbreviates Git branch status in the footer.

## User-visible behavior

- What the user can do: run `mastracode`, type prompts, see streamed assistant/tool output.
- Success looks like: input, status/footer, messages, tools, and interrupts stay coherent during a run.
- Must preserve: active streaming UI and loaded history should tell the same conversation story.

## Entry points / commands

- Commands / shortcuts / flags: `mastracode`, Enter, Ctrl+C/Escape, Ctrl+F, Ctrl+T, Ctrl+E.
- Public import path for consumers: `import { MastraTUI, createTUIState, type TUIState } from 'mastracode/tui'`.
- Automatic triggers: startup render, harness event subscription, existing-message render.

## TUI states

- Idle: editor accepts prompt; footer/status shows current thread/mode/model.
- Active / modal / error: streaming component, pending tools, approval/question overlays, abort/error cleanup.

## Headless / non-TUI behavior

- Supported: `--prompt` uses `headless.ts` and prints text/json/stream-json instead of TUI components.
- Not supported / unknown: visual parity with TUI components is not meaningful; history parity still matters.

## Streaming / loading / interrupted states

- Streaming / loading: live `message_*` and `tool_*` events update TUI projections.
- Abort / retry / resume: Ctrl+C/Escape calls `harness.abort()`; terminal cleanup comes from `agent_end`.

## Streaming vs loaded-from-history behavior

- While actively streaming: state lives in TUI projection maps like pending tools and streaming components.
- After reload / history reconstruction: `renderExistingMessages()` rebuilds from persisted messages; live-only state should not resurrect as active work.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Chat history | Harness / memory storage | TUI renderer, headless output |
| Active run | Harness runtime | TUI keyboard/status handlers |
| Display projection | `HarnessDisplayState` | Status line, tasks, tools, OM, future UIs |
| Streaming components | TUI transient projection | Chat container |
| Mutable TUI state | `TUIState` object from `createTUIState()` | Commands, extracted handlers, tests, TUI class |
| Event routing | `event-dispatch.ts` + focused handlers | Tool/message/OM/thread/status renderers |
| Abort state | Harness terminal event after TUI request | TUI cleanup |

## Key files

- `mastracode/src/tui/mastra-tui.ts` — thin lifecycle wrapper after #13413 modularization.
- `mastracode/src/tui/state.ts` — shared `TUIState`, `MastraTUIOptions`, and state factory defaults.
- `mastracode/src/tui/setup.ts` — keyboard shortcuts, submit behavior, and startup layout composition.
- `mastracode/src/tui/components/banner.ts` — static responsive header rendered before chat/frontmatter.
- `mastracode/src/tui/event-dispatch.ts` — event-to-handler routing; `display_state_changed` refreshes the status line from Harness display state; `thread_changed` refreshes Git branch.
- `packages/core/src/harness/types.ts` and `harness.ts` — `HarnessDisplayState` source for active tools/tasks/OM/current-message projection.
- `mastracode/src/tui/handlers/*` — focused message, tool, OM, prompt, and subagent handlers.
- `mastracode/src/tui/render-messages.ts` — history reconstruction.
- `mastracode/src/tui/status-line.ts`, `shell.ts` — extracted status and shell rendering helpers.
- `mastracode/src/tui/index.ts` — public TUI export barrel.
- `mastracode/package.json` and `mastracode/tsup.config.ts` — `mastracode/tui` export and build entry.
- `mastracode/src/headless.ts` — non-TUI run path.

## Dependencies / related features

- [Startup banner](./startup-banner.md) — static header in the same TUI layout.
- [Help and shortcuts](./help-and-shortcuts.md) — compact startup hint and `/help` reference.
- [Harness display state](../integrations/harness-display-state.md) — canonical active-display projection for status/tasks/tools/OM.
- [Git branch context and status](../git/branch-context.md) — footer branch text is refreshed during thread/run lifecycle events.
- [Queued follow-ups and slash commands](../chat/queued-followups.md) — active-run input queueing lives in the TUI chat path.
- [Persistent conversations](../threads/persistent-conversations.md) — chat is thread-scoped.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — selected mode/model drives runs.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — tools render inside chat.

## Existing tests

- `mastracode/src/tui/__tests__/mastra-tui-queueing.test.ts` — active-run queue/signal behavior.
- `mastracode/src/tui/__tests__/setup-keyboard-shortcuts.test.ts` — shortcut behavior.
- `mastracode/src/tui/components/__tests__/banner.test.ts` — responsive startup banner rendering.
- `mastracode/src/tui/components/__tests__/help-overlay.test.ts` — compact `/help` output.
- `packages/core/src/harness/display-state.test.ts` — display-state projection used by status/tasks/tools/OM rendering.
- `mastracode/src/tui/event-dispatch.test.ts`, `render-messages.test.ts` — event/history rendering.
- `mastracode/src/tui/handlers/*.test.ts` — focused handler coverage after #13413 extraction.
- `mastracode/src/headless.test.ts` — non-TUI path.
- `mastracode/src/tui/__tests__/*` imports `TUIState` in handler/queue/goal tests, but most tests still hand-build partial state objects.
- No dedicated package-export smoke test found for `mastracode/tui`.

## Missing tests

- Live stream → quit/reload → reconstructed UI parity.
- Abort while tool output streams, including persisted history shape.
- Enter-as-signal vs Ctrl+F queued follow-up after reload.
- Built-package import smoke for `mastracode/tui` covering ESM, CJS, and generated `.d.ts` paths.
- Direct `createTUIState()` default-shape test so queue/tool/goal fields do not silently lose defaults during TUI refactors.
- Full startup layout snapshot covering banner, frontmatter, instructions, chat, task progress, editor, and footer.

## Known risks / regressions

- Harness v1 risk: live event projection and persisted history projection can drift.
- Slack task-list report is adjacent: rendered state and prompt/tool state diverged.
- Headless abort timeout existed pre-Harness v1; treat as baseline noise until reverified.
- Public export can drift if `package.json` export targets, `tsup` entry names, or generated type paths stop matching.
- `TUIState` is now the shared mutable projection for many features; adding fields without factory defaults can break handlers only at runtime.
- TUI modularization lowered file size but increased routing seams: a missing handler import or mismatched context field can silently break one event family while the main TUI still starts.
- Startup banner is static but width/theme assumptions can affect first-run layout in narrow or non-standard terminals.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
