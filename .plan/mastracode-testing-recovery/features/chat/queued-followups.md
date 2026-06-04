# Queued follow-ups and slash commands

## Origin PR / commit

- PR: [#13345](https://github.com/mastra-ai/mastra/pull/13345) — Ctrl+F resolves autocomplete and queues slash commands while a run is active.
- Later changes: none known.

## User-visible behavior

- What the user can do: press Ctrl+F during an active run to queue a follow-up instead of sending an interjection signal.
- Success looks like: `/rev` autocomplete resolves to `/review`, then runs as a slash command after the current run finishes.
- Must preserve: FIFO order across queued plain messages, image messages, and slash commands.

## Entry points / commands

- Commands / shortcuts / flags: Ctrl+F, Enter, slash-command autocomplete.
- Automatic triggers: `agent_end` drains one queued action at a time after harness follow-ups finish.

## TUI states

- Idle: Ctrl+F submits like Enter.
- Active / modal / error: queued slash commands render as pending grey user messages until drained.

## Headless / non-TUI behavior

- Supported: not applicable; Ctrl+F and autocomplete are TUI-only.
- Not supported / unknown: no headless equivalent for queued slash-command execution.

## Streaming / loading / interrupted states

- Streaming / loading: active run owns live output; queued actions wait in TUI arrays.
- Abort / retry / resume: abort clears pending queued actions and pending user-message components.

## Streaming vs loaded-from-history behavior

- While actively streaming: TUI owns `pendingQueuedActions`, `pendingFollowUpMessages`, and `pendingSlashCommands`.
- After reload / history reconstruction: queued-but-not-drained actions are transient and should not resurrect.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Queued action order | `TUIState.pendingQueuedActions` | Agent lifecycle drain |
| Queued text/image messages | `TUIState.pendingFollowUpMessages` | `fireMessage()` after drain |
| Queued slash commands | `TUIState.pendingSlashCommands` | `handleSlashCommand()` after drain |
| Autocomplete acceptance | `CustomEditor` | Ctrl+F / Enter handlers |

## Key files

- `mastracode/src/tui/components/custom-editor.ts` — Ctrl+F accepts active autocomplete before invoking queue action.
- `mastracode/src/tui/setup.ts` — Ctrl+F shortcut reads editor text and queues only during active runs.
- `mastracode/src/tui/mastra-tui.ts` — stores queued messages/slash commands.
- `mastracode/src/tui/handlers/agent-lifecycle.ts` — drains queued actions after `agent_end`.

## Dependencies / related features

- [Interactive TUI chat](../tui/interactive-chat.md) — keyboard input and active-run state.
- [Prompt context and project instructions](./prompt-context.md) — queued slash commands must not be sent as raw LLM text.

## Existing tests

- `mastracode/src/tui/components/__tests__/custom-editor.test.ts` — Ctrl+F resolves slash autocomplete and preserves `/`.
- `mastracode/src/tui/__tests__/mastra-tui-queueing.test.ts` — FIFO drain across messages/slash commands and pending slash removal.

## Missing tests

- Real terminal/TUI integration test for Ctrl+F with an actual autocomplete provider and a live active run.
- Reload behavior proving transient queues do not resurrect from history.

## Known risks / regressions

- Queue state is TUI-only; crashes before drain lose queued commands.
- If autocomplete inserts command text without a leading slash, queued command routing depends on the slash-restoration guard.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
