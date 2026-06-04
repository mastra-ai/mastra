# Interactive TUI chat

## Origin PR / commit

- PR: [#13218](https://github.com/mastra-ai/mastra/pull/13218) — introduced the initial Mastra Code TUI port, including streaming chat, keyboard-driven input, assistant/user rendering, tool rendering, and harness event dispatch.
- Commit: `0e64154f1b` — `MastraCode initial port (#13218)`.

## User-visible behavior

Users start `mastracode` in a terminal, type a prompt, press Enter, and see a streaming assistant response in the chat area. While an agent run is active, input can either be sent into the active run as a signal or explicitly queued for the next run. The TUI also exposes interrupt, clear, mode cycling, thinking visibility, tool expansion, suspend/resume, and exit shortcuts.

## Entry points / commands

- `mastracode` interactive startup through `mastracode/src/main.ts` and `MastraTUI.start()`.
- Enter submits the editor contents through `setupKeyboardShortcuts()` / `setupKeyHandlers()` (`mastracode/src/tui/setup.ts:165`).
- Ctrl+F explicitly queues a follow-up while the agent is active (`mastracode/src/tui/setup.ts:178`).
- Ctrl+C/Escape aborts an active run, dismisses active prompts, clears idle input, or exits on double-tap (`mastracode/src/tui/setup.ts:36`).
- Ctrl+T toggles thinking block visibility; Ctrl+E expands/collapses tools, slash commands, shell output, and system reminders (`mastracode/src/tui/setup.ts:113`, `mastracode/src/tui/setup.ts:119`).

## TUI states

- Startup builds layout, installs autocomplete/key handlers, subscribes to harness events, loads OM progress, syncs current thread metadata, renders existing messages/tasks, and may show onboarding (`mastracode/src/tui/mastra-tui.ts:520`).
- Active run state starts on `agent_start`, clears idle timer, and starts macOS caffeinate (`mastracode/src/tui/mastra-tui.ts:663`).
- Harness events are projected into TUI components through `dispatchEvent()` (`mastracode/src/tui/event-dispatch.ts:56`).
- Message/tool lifecycle states are event-driven: `message_start`, `message_update`, `message_end`, `tool_start`, `tool_update`, `tool_end` (`mastracode/src/tui/event-dispatch.ts:72`).
- Terminal status/footer depends on current mode/model/thread/resource/project state plus OM and GitHub badge projections.

## Headless / non-TUI behavior

Headless mode does not use the TUI chat renderer. It is entered with `--prompt` / `-p`, parses options in `headless.ts`, subscribes to harness events, and prints text/json/stream-json output instead of pi-tui components (`mastracode/src/headless.ts:32`, `mastracode/src/headless.ts:140`).

## Streaming / loading / interrupted states

- Streaming assistant messages are updated incrementally from harness `message_update` events.
- Tool calls can stream input deltas and shell output separately (`mastracode/src/tui/event-dispatch.ts:101`, `mastracode/src/tui/event-dispatch.ts:105`).
- Interrupt uses `state.harness.abort()` and marks `userInitiatedAbort` before the harness emits `agent_end` with `reason: aborted` (`mastracode/src/tui/setup.ts:50`).
- Agent end restarts idle timing, runs Stop hooks, and stops caffeinate (`mastracode/src/tui/mastra-tui.ts:689`).

## Streaming vs loaded-from-history behavior

During streaming, UI state is built from live harness events and temporary maps such as `streamingComponent`, `pendingTools`, `pendingTaskToolIds`, and `messageComponentsById` (`mastracode/src/tui/state.ts:157`). After reload/history render, `renderExistingMessages()` reconstructs chat from persisted harness messages; live-only affordances such as active stream component, pending tool state, queued signal components, and caffeinate are not restored as active work. Reload correctness depends on persisted messages containing enough structure to rebuild assistant/tool/task components, not just raw text.

## State ownership

- Current run state: harness runtime is authoritative; TUI stores a projection for rendering and keyboard decisions.
- Chat history: harness/memory storage is authoritative; TUI `chatContainer` and component maps are projections.
- Active streaming components: TUI-only transient state.
- Input draft/history: editor/TUI-only state.
- Abort status: TUI initiates through `harness.abort()`, harness emits the terminal event.
- Thread metadata loaded at startup: harness/storage is authoritative; TUI caches status-line projections (`mastracode/src/tui/mastra-tui.ts:106`).

## Key files

- `mastracode/src/tui/mastra-tui.ts` — top-level TUI class, startup flow, harness subscription, event handling, idle/caffeinate behavior.
- `mastracode/src/tui/setup.ts` — keyboard shortcuts, layout, autocomplete, submit/queue handlers.
- `mastracode/src/tui/event-dispatch.ts` — maps harness events into TUI handlers.
- `mastracode/src/tui/state.ts` — mutable TUI projection and transient streaming state.
- `mastracode/src/tui/render-messages.ts` — reconstructs persisted messages into UI components.
- `mastracode/src/headless.ts` — non-TUI execution path.

## Dependencies / related features

- [Persistent conversations](../threads/persistent-conversations.md) — interactive chat is always scoped to the active thread/resource.
- [Model auth and modes](../models/model-auth-and-modes.md) — footer/model state and run routing depend on selected mode/model.
- [Coding tools and permissions](../tools/coding-tools-permissions.md) — tool events and approvals are rendered inside chat.

## Existing tests

- `mastracode/src/tui/__tests__/mastra-tui-queueing.test.ts` — active-run message queue/signal behavior.
- `mastracode/src/tui/__tests__/setup-keyboard-shortcuts.test.ts` — keyboard shortcut behavior and command autocomplete.
- `mastracode/src/tui/event-dispatch.test.ts` — harness event dispatch behavior.
- `mastracode/src/tui/render-messages.test.ts` — loaded-from-history rendering behavior.
- `mastracode/src/headless.test.ts` and `mastracode/src/headless-integration.test.ts` — non-TUI path.

## Missing tests

- End-to-end TUI reload test proving a streamed assistant/tool/task sequence renders identically after restart from persisted history.
- Abort-while-tool-streaming test that validates both live UI cleanup and persisted history shape.
- Explicit test for Enter signal vs Ctrl+F queued follow-up with loaded history after the active run completes.

## Known risks / regressions

- Harness v1 migration risk: live event projection, persisted message shape, and loaded-from-history reconstruction can drift silently.
- Slack-reported task list issue likely belongs to this class: rendered state and prompt/tool state diverged during active vs context rendering.
- Pre-existing `headless-integration.test.ts` abort timeout existed before Harness v1, so it is known noise rather than proven v1 regression.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
