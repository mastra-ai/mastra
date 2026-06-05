# Queued follow-ups and slash commands

## Origin PR / commit

- PR: [#13345](https://github.com/mastra-ai/mastra/pull/13345) — Ctrl+F resolves autocomplete and queues slash commands while a run is active.
- Later changes: [#13493](https://github.com/mastra-ai/mastra/pull/13493) — preserves custom slash-command arguments when the template has no `$ARGUMENTS`/`$1+` placeholders, and treats `$0` as literal shell text rather than a positional argument; [#14250](https://github.com/mastra-ai/mastra/pull/14250) — refined active-run follow-up UX with FIFO message/slash queues, queued-count status, history insertion, autocomplete-first selection, and `//custom-command` precedence; [#14727](https://github.com/mastra-ai/mastra/pull/14727) — fixes custom slash-command discovery/loading with deterministic source priority and name dedupe; [#15678](https://github.com/mastra-ai/mastra/pull/15678) — keeps `//custom-command` dispatch scoped to the active thread’s `state.customSlashCommands` so custom commands do not leak across thread switches; [#16231](https://github.com/mastra-ai/mastra/pull/16231) — moves active-run text follow-ups to Harness Agent signals while keeping Ctrl+F as the explicit queue shortcut and image/slash fallbacks on the transient queue; [#16790](https://github.com/mastra-ai/mastra/pull/16790) — runs slash commands immediately during active runs through the signal/pending-message path instead of waiting for post-run queue drain.

## User-visible behavior

- What the user can do: press Ctrl+F during an active run to explicitly queue a follow-up, send normal active-run text with Enter as a Harness signal, run slash/custom slash commands immediately during active runs when signal routing is available, queue image follow-ups when signals cannot carry them, or run custom slash commands loaded from user/project command directories.
- Success looks like: queued messages/slash commands drain one at a time in FIFO order after the active run and Harness follow-ups finish; `/rev` autocomplete resolves to `/review`; `//gh-debug-issue 123` exposes `123` to the model even if the template omits argument placeholders; custom commands load from the configured priority order and the status line shows queued work.
- Must preserve: FIFO order across queued plain messages, image messages, and slash commands; queued messages enter editor history; unused custom-command args must not be dropped or shell-executed; later custom-command sources override earlier duplicate names deterministically; active-thread custom command lists must not leak across thread switches; active-run Enter text must not accidentally go through the old queue path unless image attachments force queuing.

## Entry points / commands

- Commands / shortcuts / flags: Enter sends a message; Ctrl+F explicitly queues a follow-up while a run is active; slash-command autocomplete resolves before Enter/Ctrl+F handling.
- Automatic triggers: `agent_end` drains one queued action at a time after harness follow-ups finish; queued count appears in the status line from TUI queue state plus Harness follow-up count.

## TUI states

- Idle: Enter sends; Ctrl+F submits like Enter when the harness is idle.
- Active / modal / error: Enter sends normal text as a signal in current source; slash/custom slash commands create pending messages and send immediately unless blocked by goal-judge evaluation; Ctrl+F queues explicit follow-ups; image follow-ups queue when active-run signals cannot carry the pasted image path; explicitly queued slash commands render as pending grey user messages until drained.

## Headless / non-TUI behavior

- Supported: not applicable; Ctrl+F and autocomplete are TUI-only.
- Not supported / unknown: no headless equivalent for queued slash-command execution.

## Streaming / loading / interrupted states

- Streaming / loading: active run owns live output; queued actions wait in TUI arrays.
- Abort / retry / resume: abort clears pending queued actions and pending user-message components.

## Streaming vs loaded-from-history behavior

- While actively streaming: TUI owns `pendingQueuedActions`, `pendingFollowUpMessages`, and `pendingSlashCommands`; active-run signal messages are tracked separately via pending signal-message components.
- After reload / history reconstruction: queued-but-not-drained actions are transient and should not resurrect; queued messages already added to editor history remain local editor history only.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Queued action order | `TUIState.pendingQueuedActions` | Agent lifecycle drain |
| Queued text/image messages | `TUIState.pendingFollowUpMessages` | `fireMessage()` after drain |
| Queued/immediate slash commands | `TUIState.pendingSlashCommands` + `pendingSlashCommandMessageIds` + command-dispatch active-run signal path | `handleSlashCommand()` after drain for explicit queues; immediate pending-message signal dispatch during active runs; pending grey user-message removal |
| Active-run signal messages | Agent/Harness signals + `pendingSignalMessageComponentsById` | active-run interjections, server-side follow-up queueing, echo dedupe |
| Queued count | `pendingQueuedActions.length + harness.getFollowUpCount()` | status line `N queued` label |
| Custom command discovery | `loadSlashCommands()` priority-ordered directories + Map dedupe by command name | Editor autocomplete, `/help` custom command list |
| Active custom command list | `state.customSlashCommands` on the active thread/session | `//custom-command` dispatch and `/command` fallback in `command-dispatch.ts` |
| Custom command arguments | `processSlashCommand()` template processor | Slash-command message payload |
| Autocomplete acceptance | `CustomEditor` | Ctrl+F / Enter handlers; first visible match highlighted |

## Key files

- `mastracode/src/tui/components/custom-editor.ts` — Ctrl+F accepts active autocomplete before invoking queue action; Enter resolves slash autocomplete only when it remains a slash command; first visible slash-command match is highlighted.
- `mastracode/src/tui/setup.ts` — Enter submits through editor `onSubmit`; Ctrl+F queues only during active runs and records queued text in editor history.
- `mastracode/src/tui/mastra-tui.ts` — stores queued messages/slash commands, routes active-run Enter text to `signalMessage()`, and keeps active image follow-ups on the queue path.
- `mastracode/src/tui/handlers/agent-lifecycle.ts` — drains queued actions after `agent_end`, after Harness signal follow-ups, one FIFO item per completed run.
- `mastracode/src/tui/status-line.ts` — renders `N queued` using TUI queue length plus Harness follow-up count.
- `mastracode/src/tui/command-dispatch.ts` — routes `//name` to the active `state.customSlashCommands` list, keeps built-in `/name` commands preferred over custom collisions, falls back to custom `/name` when no built-in matches, and sends active-run slash commands through the pending signal path with judge-evaluation blocking.
- `mastracode/src/utils/slash-command-loader.ts` — discovers custom commands from OpenCode/Claude/Mastra user and project directories, derives names/namespaces, parses frontmatter, and dedupes by command name.
- `mastracode/src/utils/slash-command-processor.ts` — expands `$ARGUMENTS`/`$1+`, appends unused raw args after shell/file expansion, and preserves literal `$0`.

## Dependencies / related features

- [Agent signals and streaming follow-ups](./agent-signals.md) — active-run Enter text now uses persisted/subscribed signal delivery.
- [Interactive TUI chat](../tui/interactive-chat.md) — keyboard input and active-run state.
- [Prompt context and project instructions](./prompt-context.md) — queued slash commands must not be sent as raw LLM text.
- [GitHub issue reporting command](../integrations/github-issue-reporting.md) — `/report-issue` uses slash-command prompt injection.

## Existing tests

- `mastracode/src/tui/components/__tests__/custom-editor.test.ts` — Ctrl+F resolves slash autocomplete and preserves `/`, Enter submits selected slash commands, non-slash autocomplete does not submit, and first visible slash-command match is highlighted.
- `mastracode/src/tui/__tests__/mastra-tui-queueing.test.ts` — active-run Enter signal path, active-run slash-command immediate path, FIFO drain across messages/slash commands, queued image metadata, pending slash removal, queued actions before goal continuation, and signal/echo dedupe.
- `mastracode/src/tui/__tests__/status-line.test.ts` — queued-count status label from TUI queue + Harness follow-up count.
- `mastracode/src/utils/__tests__/slash-command-loader.test.ts` — custom slash-command discovery, namespace/name parsing, source priority, and duplicate-name override behavior.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` — `//deploy` active-thread custom command routing, built-in `/new` precedence over a custom collision, and `//new` custom-command override behavior.
- `mastracode/src/utils/__tests__/slash-command-processor.test.ts` — current file-reference behavior only; no direct coverage for #13493 argument append / `$0` preservation.

## Missing tests

- Real terminal/TUI integration test for Ctrl+F and Enter with an actual autocomplete provider, live active run, and image paste state.
- Reload behavior proving transient queues do not resurrect from history.
- Custom slash-command processor tests for: no placeholders appends `ARGUMENTS`, `$ARGUMENTS` suppresses append, `$1+` suppresses append, and `$0` remains literal.

## Known risks / regressions

- Queue state is TUI-only; crashes before drain lose queued commands.
- Current source no longer matches #14250's original "Enter queues while busy" release note for plain text; Enter now signals active-run text, while Ctrl+F remains explicit queueing. Tests should distinguish those paths.
- If autocomplete inserts command text without a leading slash, queued command routing depends on the slash-restoration guard.
- Raw args append after shell/file expansion prevents command injection, but the final LLM-visible payload can still duplicate intent if templates also describe custom placeholders in prose.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
