# Interactive TUI chat

## Origin PR / commit

- PR: [#13218](https://github.com/mastra-ai/mastra/pull/13218) — initial TUI chat, streaming render, keyboard input, tool render, harness event dispatch.
- Later changes: [#13245](https://github.com/mastra-ai/mastra/pull/13245) — replaced the local prototype harness with core Harness events and interactive prompt primitives; [#13255](https://github.com/mastra-ai/mastra/pull/13255) — added the public `mastracode/tui` package export; [#13345](https://github.com/mastra-ai/mastra/pull/13345) — fixed Ctrl+F queued slash-command/autocomplete behavior; [#13350](https://github.com/mastra-ai/mastra/pull/13350) — extracted shared `TUIState` / `createTUIState()`; [#13413](https://github.com/mastra-ai/mastra/pull/13413) — split the large TUI class into setup, event-dispatch, handlers, status-line, shell, and history-render modules without changing user-facing chat behavior; [#13422](https://github.com/mastra-ai/mastra/pull/13422) — added the responsive startup banner above the chat layout; [#13426](https://github.com/mastra-ai/mastra/pull/13426) — simplified the startup command hint and `/help` reference; [#13427](https://github.com/mastra-ai/mastra/pull/13427) — added core `HarnessDisplayState` and centralized status-line refresh through `display_state_changed`; [#13456](https://github.com/mastra-ai/mastra/pull/13456) — refreshes and abbreviates Git branch status in the footer; [#13460](https://github.com/mastra-ai/mastra/pull/13460) — wires `fd`/`fdfind` into editor file autocomplete; [#13442](https://github.com/mastra-ai/mastra/pull/13442) — runs prompt-submit and stop hooks in the TUI lifecycle; [#13487](https://github.com/mastra-ai/mastra/pull/13487) — applies terminal theme detection and contrast-aware colors across the TUI; [#13556](https://github.com/mastra-ai/mastra/pull/13556) — adds Quiet mode projection for compact output; [#13609](https://github.com/mastra-ai/mastra/pull/13609) — preserves existing assistant text when tool-result-only chunks produce an empty trailing segment; [#13691](https://github.com/mastra-ai/mastra/pull/13691) — keeps console warn/error noise out of the TUI unless `MASTRA_DEBUG` is enabled; [#13696](https://github.com/mastra-ai/mastra/pull/13696) — queues parallel inline questions/access requests so they do not overwrite each other; [#13712](https://github.com/mastra-ai/mastra/pull/13712) — adds explicit Ctrl+V / Alt+V clipboard paste handling in the editor; [#13723](https://github.com/mastra-ai/mastra/pull/13723) — changes Ctrl+Z to suspend the Unix process and moves undo-last-clear to Alt+Z; [#13999](https://github.com/mastra-ai/mastra/pull/13999) — streams `!` shell passthrough output into a live TUI component; [#14423](https://github.com/mastra-ai/mastra/pull/14423) — polished prompt/editor animation and history/chat styling while later HEAD consolidated animation into `CustomEditor` + `GradientAnimator`; [#15082](https://github.com/mastra-ai/mastra/pull/15082) — prunes old rendered chat components during long sessions so TUI memory does not grow without bound; [#15088](https://github.com/mastra-ai/mastra/pull/15088) — fixes pruning to use a count-based splice so the newest 100 children are reliably preserved; [#15942](https://github.com/mastra-ai/mastra/pull/15942) — renders the submitted user message optimistically before prompt hooks, pending-thread creation, and signal async work complete; [#15993](https://github.com/mastra-ai/mastra/pull/15993) — tightens `UserMessageComponent` border sizing when the first line exactly fills available width; [#16006](https://github.com/mastra-ai/mastra/pull/16006) — treats non-headless piped stdin as the first interactive TUI message after draining and reopening the terminal; [#16231](https://github.com/mastra-ai/mastra/pull/16231) — routes active-run Enter follow-ups through Agent signals with pending interjection components and echo dedupe; [#16790](https://github.com/mastra-ai/mastra/pull/16790) — lets slash/custom slash commands run immediately during active runs via pending signal messages while keeping goal-judge evaluation locked; [#17008](https://github.com/mastra-ai/mastra/pull/17008) — blocks mode switching while the agent or plan approval is active, avoids duplicate Ctrl+F follow-up handling, and keeps render updates responsive around modal/active-run input paths; [#17240](https://github.com/mastra-ai/mastra/pull/17240) — renders streamed and loaded state/reactive signal rows inline in the chat; [#17241](https://github.com/mastra-ai/mastra/pull/17241) — renders streamed and loaded notification-summary/full-notification rows inline in the chat; [#17447](https://github.com/mastra-ai/mastra/pull/17447) — hides internal GitHub subscribe/unsubscribe operation signals from normal chat rendering; [#17431](https://github.com/mastra-ai/mastra/pull/17431) — truncates user-message, inline prompt, and plan-approval bordered lines that exceed narrow terminal widths.

## User-visible behavior

- What the user can do: run `mastracode`, type prompts, pipe content into interactive startup (`cat file.txt | mastracode`), see animated/polished editor feedback, see streamed assistant/tool output, queue explicit Ctrl+F follow-ups, and switch modes only when no active run or plan approval is in progress.
- Success looks like: input, prompt animation, status/footer, messages, tools, state/reactive/notification signal rows, and interrupts stay coherent during a run; submitted/piped user messages appear immediately before slow prompt hooks/thread creation/signal acceptance; internal GitHub subscribe/unsubscribe operation signals stay hidden behind dedicated status UI; full-width first-line user-message borders stay aligned; overlong bordered lines are truncated to the available inner width on narrow terminals; long sessions keep recent rendered chat while old component instances are pruned.
- Must preserve: active streaming UI and loaded history should tell the same conversation story, and optimistic user-message components must be removed/remapped when prompt hooks block or Harness returns a signal id.

## Entry points / commands

- Commands / shortcuts / flags: `mastracode`, Enter, `!<command>` shell passthrough, Ctrl+C/Escape, Ctrl+F explicit queue, Shift+Tab mode cycle, Ctrl+T, Ctrl+E, Ctrl+Z suspend, Alt+Z undo, Ctrl+V / Alt+V paste.
- Public import path for consumers: `import { MastraTUI, createTUIState, type TUIState } from 'mastracode/tui'`.
- Automatic triggers: startup render, harness event subscription, existing-message render.

## TUI states

- Idle: editor accepts prompt or initial piped stdin content, renders a user message immediately after submission, then runs prompt hooks / pending-thread creation / Harness signal dispatch; footer/status shows current thread/mode/model.
- Active / modal / error: streaming component, pending tools, approval/question overlays, abort/error cleanup; active-run interjections use pending/optimistic user-message components until the stream echo dedupes them.

## Headless / non-TUI behavior

- Supported: `--prompt` uses `headless.ts` and prints text/json/stream-json instead of TUI components.
- Not supported / unknown: visual parity with TUI components is not meaningful; history parity still matters.

## Streaming / loading / interrupted states

- Streaming / loading: live `message_*` and `tool_*` events update TUI projections; tool-result-only chunks must not blank already-rendered assistant text; streamed `state_signal` / `reactive_signal` parts insert inline components before pending assistant text. User submissions and piped initial messages render optimistically before async hooks/thread creation/signal work, then either remap to the returned signal id or are removed on hook/signal failure. After agent end/abort/error cleanup, `pruneChatContainer()` caps rendered chat children from >200 down to the most recent 100.
- Abort / retry / resume: Ctrl+C/Escape calls `harness.abort()`; abort/error cleanup also prunes old rendered chat components; global warn/error console output is silenced or redirected before it can corrupt the active TUI.

## Streaming vs loaded-from-history behavior

- While actively streaming: state lives in TUI projection maps like pending tools and streaming components; pruning only runs after lifecycle cleanup, not mid-token stream.
- After reload / history reconstruction: `renderExistingMessages()` rebuilds from persisted messages; live-only state should not resurrect as active work. Pruned components are only an in-memory TUI cap and do not delete persisted thread history.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Chat history | Harness / memory storage plus transient optimistic user-message projection before Harness echo | TUI renderer, headless output, signal echo dedupe, initial piped-message rendering |
| Active-run signal projection | `pendingSignalMessageComponentsById` + returned/echoed signal ids | interjection display, remap/remove on acceptance failure, persisted signal history reconstruction |
| Active run and mode-cycle lock | Harness runtime + `setupKeyboardShortcuts()` guards for running agents/active plan approval | TUI keyboard/status handlers, Shift+Tab mode cycling, Ctrl+F explicit follow-up queueing |
| Display projection | `HarnessDisplayState` | Status line, tasks, tools, OM, future UIs |
| Streaming components | TUI transient projection; trailing content after inline boundaries including state/reactive/notification signals; local shell passthrough output component | Chat container |
| Rendered chat component cap | `pruneChatContainer()` on lifecycle cleanup, `MAX_CHILDREN=200`, `KEEP_CHILDREN=100` | Chat container plus tool/slash/system-reminder/shell/pending-signal tracking arrays |
| Prompt/editor animation + message borders | `CustomEditor` prompt timing + shared `GradientAnimator` sweep helpers + `UserMessageComponent` border sizing using `visibleWidth()`/`truncateToWidth()` and per-line truncation inside bordered boxes | Editor border/prompt, user message box alignment, narrow-terminal clipping, status/OM progress polish |
| Mutable TUI state | `TUIState` object from `createTUIState()` | Commands, extracted handlers, tests, TUI class |
| Autocomplete provider | `setupAutocomplete()` | Editor slash, skill, custom command, and `@` file suggestions |
| Clipboard paste projection | `CustomEditor` + OS clipboard helpers | Editor text insertion and image-paste callback |
| Process suspend shortcut | `CustomEditor` + `setupKeyboardShortcuts()` + `SIGTSTP`/`SIGCONT` | TUI process/UI lifecycle |
| Hook lifecycle | `HookManager` + TUI run/event loop | Prompt submit, stop/session hook execution |
| Event routing | `event-dispatch.ts` + focused handlers | Tool/message/OM/thread/status renderers |
| Inline prompt queue | `activeInlineQuestion` + `pendingInlineQuestions` | `ask_user`, `request_access`, editor input routing |
| Abort state | Harness terminal event after TUI request | TUI cleanup |

## Key files

- `mastracode/src/tui/mastra-tui.ts` — thin lifecycle wrapper after #13413 modularization; routes `!` shell passthrough input, processes `options.initialMessage` from piped stdin, and owns optimistic user-message rendering/remap/removal around prompt hooks, pending-thread creation, and `sendSignal()`.
- `mastracode/src/tui/shell.ts` and `components/shell-output.ts` — local shell passthrough streaming and live output component.
- `mastracode/src/tui/state.ts` — shared `TUIState`, `MastraTUIOptions`, and state factory defaults.
- `mastracode/src/tui/setup.ts` — keyboard shortcuts, submit behavior, startup layout composition, and autocomplete provider wiring.
- `mastracode/src/tui/components/banner.ts` — static responsive header rendered before chat/frontmatter.
- `mastracode/src/tui/event-dispatch.ts` — event-to-handler routing; `display_state_changed` refreshes the status line from Harness display state; `thread_changed` refreshes Git branch.
- `packages/core/src/harness/types.ts` and `harness.ts` — `HarnessDisplayState` source for active tools/tasks/OM/current-message projection.
- `mastracode/src/tui/handlers/message.ts` — assistant streaming partitioning, inline state/reactive/notification signal rendering, hidden GitHub operation-signal filtering, and text-preservation guard after tool updates.
- `mastracode/src/tui/prune-chat.ts` — long-session rendered-component cap; removes old chat children and stale tracked tool/slash/reminder/shell/pending signal component references.
- `mastracode/src/tui/handlers/agent-lifecycle.ts` — calls chat pruning on agent end, abort, and error cleanup.
- `mastracode/src/tui/handlers/*` — focused tool, OM, prompt, and subagent handlers; prompt handlers own the inline question queue.
- `mastracode/src/tui/render-messages.ts` — history reconstruction, persisted user/state/reactive/notification signal rendering, hidden GitHub operation-signal filtering, and optimistic/signal message reconciliation.
- `mastracode/src/tui/components/notification.ts` and `notification-summary.ts` — inline notification cards and pending-summary hints for `notification_inbox`.
- `mastracode/src/tui/status-line.ts`, `shell.ts` — extracted status and shell rendering helpers.
- `mastracode/src/tui/components/custom-editor.ts`, `obi-loader.ts`, and `user-message.ts` — editor prompt animation, shared gradient sweep, and polished message framing including first-line full-width border sizing plus narrow-terminal line truncation.
- `mastracode/src/tui/index.ts` — public TUI export barrel.
- `mastracode/package.json` and `mastracode/tsup.config.ts` — `mastracode/tui` export and build entry.
- `mastracode/src/headless.ts` — non-TUI run path.

## Dependencies / related features

- [Startup banner](./startup-banner.md) — static header in the same TUI layout.
- [Interactive prompts and access requests](./interactive-prompts.md) — inline prompt queueing for parallel tool calls.
- [Terminal theme and contrast](./terminal-theme.md) — global TUI color palette and detection.
- [File autocomplete](./file-autocomplete.md) — editor `@` file suggestions share the autocomplete setup path.
- [Clipboard paste](./clipboard-paste.md) — Ctrl+V / Alt+V and bracketed-paste handling live in the same editor.
- [Process suspend shortcut](./process-suspend.md) — Ctrl+Z / Alt+Z and suspend/resume lifecycle live in the same editor/setup path.
- [Help and shortcuts](./help-and-shortcuts.md) — compact startup hint and `/help` reference.
- [Harness display state](../integrations/harness-display-state.md) — canonical active-display projection for status/tasks/tools/OM.
- [Lifecycle hooks](../integrations/lifecycle-hooks.md) — prompt-submit and stop hooks run through this TUI loop.
- [Git branch context and status](../git/branch-context.md) — footer branch text is refreshed during thread/run lifecycle events.
- [Agent signals and streaming follow-ups](../chat/agent-signals.md) — active-run text interjections use signal delivery and echo dedupe.
- [Processor state signals](../chat/processor-state-signals.md) — processor/browser state and reactive signals render as inline chat rows.
- [Notification inbox signals](../chat/notification-inbox-signals.md) — notification cards and summaries render as inline chat rows.
- [GitHub signal subscriptions](../git/github-signal-subscriptions.md) — GitHub operation signals are hidden while status/notifications render through dedicated UI.
- [Queued follow-ups and slash commands](../chat/queued-followups.md) — active-run input queueing lives in the TUI chat path.
- [File attachments in chat input](../chat/file-attachments.md) — chat input can include file/image parts in addition to text.
- [Persistent conversations](../threads/persistent-conversations.md) — chat is thread-scoped.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — selected mode/model drives runs.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — tools render inside chat.
- [Shell passthrough streaming](./shell-passthrough.md) — `!` local shell command output renders in the chat container while running.

## Existing tests

- `mastracode/src/tui/__tests__/mastra-tui-queueing.test.ts` — active-run queue/signal behavior, optimistic-message remapping before stream echo dedupe, and pending-new-thread signal deferral.
- `mastracode/src/tui/__tests__/state.test.ts` — `createTUIState()` default maps, queues, flags, dependencies, project info, and mode-color callback shape used by chat handlers.
- `mastracode/src/tui/__tests__/setup-keyboard-shortcuts.test.ts` — shortcut behavior, slash autocomplete ordering, active-run mode-switch blocking, and Ctrl+F explicit queue behavior.
- `mastracode/src/tui/components/__tests__/custom-editor.test.ts` — slash autocomplete, Ctrl+F queue resolution, prompt animation, and paste behavior.
- `mastracode/src/tui/__tests__/mastra-tui-hooks.test.ts` — prompt-submit/stop hook wiring.
- `mastracode/src/utils/__tests__/stdin-pipe.test.ts` — piped stdin sanitization/drain behavior used by interactive initial-message startup.
- `mastracode/src/tui/components/__tests__/banner.test.ts` — responsive startup banner rendering.
- `mastracode/src/tui/components/__tests__/help-overlay.test.ts` — compact `/help` output.
- `packages/core/src/harness/display-state.test.ts` — display-state projection used by status/tasks/tools/OM rendering.
- `mastracode/src/tui/event-dispatch.test.ts`, `render-messages.test.ts` — event/history rendering, notification rows, and hidden GitHub operation-signal filtering.
- `mastracode/src/tui/__tests__/prune-chat.test.ts` — #15082/#15088 cap behavior: >200 children prunes via count-based splice to the newest 100 and removes stale tracked tool/slash/system-reminder/shell component references.
- `mastracode/src/tui/handlers/*.test.ts` — focused handler coverage after #13413 extraction, including spacing around quiet tool previews.
- `mastracode/src/headless.test.ts` — non-TUI path.
- `mastracode/src/tui/__tests__/*` imports `TUIState` in handler/queue/goal tests, but most tests still hand-build partial state objects.
- `mastracode/src/tui/__tests__/shell.test.ts` and `shell-result.test.ts` — local shell passthrough subprocess/completion behavior.
- No dedicated package-export smoke test found for `mastracode/tui`.

## Missing tests

- Live stream → quit/reload → reconstructed UI parity.
- Abort while tool output streams, including persisted history shape.
- End-to-end TUI test proving a submitted idle prompt appears before a slow `UserPromptSubmit` hook / pending-thread creation resolves, then is removed when the hook blocks.
- Direct render snapshot for `UserMessageComponent` when the first line exactly fills the available width and when a long ANSI/wide-character line must be truncated in a narrow terminal.
- End-to-end `cat file.txt | mastracode` smoke proving stdin is drained, sanitized, rendered as initial message, and keyboard input still works after TTY reopen.
- Enter-as-signal vs Ctrl+F queued follow-up after reload.
- Built-package import smoke for `mastracode/tui` covering ESM, CJS, and generated `.d.ts` paths.
- Regression test for #13609: assistant text before a tool remains visible after a tool-result-only update and final chunk with no trailing text.
- Full startup layout snapshot covering banner, frontmatter, instructions, chat, task progress, editor, and footer.
- Component-level shell passthrough test proving incremental output appears before process exit and is not persisted as chat history.
- Lifecycle handler tests proving `pruneChatContainer()` is invoked on normal `agent_end`, abort, and error paths, not only the helper's direct behavior.
- Long-session regression covering `messageComponentsById` after pruning, because #15082 prunes several tracking arrays but does not currently remove message-id component map entries.

## Known risks / regressions

- Harness v1 risk: live event projection, optimistic local user-message projection, and persisted history projection can drift.
- Slack task-list report is adjacent: rendered state and prompt/tool state diverged.
- Headless abort timeout existed pre-Harness v1; treat as baseline noise until reverified.
- Public export can drift if `package.json` export targets, `tsup` entry names, or generated type paths stop matching.
- `TUIState` is now the shared mutable projection for many features; adding fields without factory defaults can break handlers only at runtime.
- TUI modularization lowered file size but increased routing seams: a missing handler import or mismatched context field can silently break one event family while the main TUI still starts.
- Streaming text preservation depends on `getTrailingContentParts()` treating tool/results/signals as inline boundaries; adding a new boundary type without updating it can blank or duplicate text.
- Startup banner is static but width/theme assumptions can affect first-run layout in narrow or non-standard terminals.
- The pruning helper removes chat-container children and selected tracking arrays, but `messageComponentsById` may still retain old component references unless later cleanup covers it.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
