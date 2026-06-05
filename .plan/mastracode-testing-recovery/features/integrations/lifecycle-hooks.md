# Lifecycle hooks

## Origin PR / commit

- PR: [#13442](https://github.com/mastra-ai/mastra/pull/13442) — triggers `Stop` and `UserPromptSubmit` hooks from the TUI run loop.
- Related origin: earlier hooks infrastructure added `PreToolUse`, `PostToolUse`, session, and notification hook types.
- Later changes: [#14586](https://github.com/mastra-ai/mastra/pull/14586) — uses the same `agent_start`/`agent_end` lifecycle to start/stop macOS `caffeinate` during active runs.

## User-visible behavior

- What the user can do: configure shell-command hooks in global or project `hooks.json`; use `/hooks` to inspect or reload them; rely on active macOS runs staying awake.
- Success looks like: `UserPromptSubmit` can block non-command prompts before they reach the agent, `Stop` runs after every agent ending reason (`complete`, `aborted`, `error`), and `caffeinate` cleanup happens even when stop hooks/error handling run.
- Must preserve: blocking semantics for `PreToolUse` / `UserPromptSubmit` / `Stop`, warning display, project hooks appended after global hooks, and no leaked lifecycle-owned processes.

## Entry points / commands

- Commands / shortcuts / flags: `/hooks`, `/hooks reload`; hook config files at project and global `.mastracode/hooks.json` paths; `MASTRACODE_DISABLE_CAFFEINATE=1`.
- Automatic triggers: tool execution (`PreToolUse` / `PostToolUse`), TUI prompt submit (`UserPromptSubmit`), `agent_start`/`agent_end` (`caffeinate`), `agent_end` (`Stop`), TUI `run()` / `stop()` (`SessionStart` / `SessionEnd`).

## TUI states

- Idle: `/hooks` lists configured events and config paths; `UserPromptSubmit` runs before optimistic prompt send proceeds.
- Active / modal / error: `Stop` runs after `agent_end`; hook warnings are shown as info, hook failures/errors are shown as TUI errors.

## Headless / non-TUI behavior

- Supported: tool hooks wrap dynamic tools before execution.
- Not supported / unknown: `UserPromptSubmit`, `Stop`, `SessionStart`, and `SessionEnd` are wired through the TUI path; headless parity was not verified.

## Streaming / loading / interrupted states

- Streaming / loading: `Stop` runs after live `agent_end`, including aborted/error endings; it does not reconstruct from history.
- Abort / retry / resume: aborted runs pass `stop_reason: 'aborted'`; hook failures are reported but do not undo the already-ended run.

## Streaming vs loaded-from-history behavior

- While actively streaming: hooks execute against live events and can block prompt/tool progression.
- After reload / history reconstruction: prior hook side effects are not replayed; only future live events trigger hooks.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Hook config | Global/project `hooks.json`, loaded by `HookManager` | Tool wrapper, TUI lifecycle, `/hooks` |
| Session id | Harness thread events update `HookManager` | Hook stdin payloads |
| Blocking decision | Hook process stdout / exit code 2 | Tool wrapper, TUI prompt submit, Stop warning path |
| Active-run keep-awake process | `MastraTUI.caffeinateProcess`, started on `agent_start`, killed in `agent_end` finally and `stop()` | macOS TUI runtime |

## Key files

- `mastracode/src/hooks/config.ts` — loads and merges global then project hook configs.
- `mastracode/src/hooks/executor.ts` — runs shell commands, passes JSON stdin, interprets blocking decisions and warnings.
- `mastracode/src/hooks/manager.ts` — builds event-specific hook stdin payloads.
- `mastracode/src/agents/tools.ts` — wraps dynamic tools with `PreToolUse` / `PostToolUse`.
- `mastracode/src/tui/mastra-tui.ts` — wires `UserPromptSubmit`, `Stop`, `SessionStart`, `SessionEnd`, and macOS `caffeinate` start/stop into the TUI lifecycle.
- `mastracode/src/tui/commands/hooks.ts` — `/hooks` status and reload command.

## Dependencies / related features

- [Interactive TUI chat](../tui/interactive-chat.md) — prompt submission and agent lifecycle events live here.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — tool hooks run around tool execution and can block before approval/tool runtime proceeds.
- [Queued follow-ups and slash commands](../chat/queued-followups.md) — queued non-command prompts should still pass through `UserPromptSubmit` when submitted.

## Existing tests

- `mastracode/src/tui/__tests__/mastra-tui-hooks.test.ts` — verifies `UserPromptSubmit` allow/block behavior, `Stop` reasons, and caffeinate cleanup interactions.
- `mastracode/src/agents/tools.test.ts` — verifies `PreToolUse` / `PostToolUse` wrapping, block behavior, and post-hook execution on tool errors.

## Missing tests

- Direct hook config/executor tests for global+project merge order, invalid config handling, JSON stdout parsing, timeouts, and exit-code-2 blocking.
- `/hooks` command tests for status, reload, and no-config guidance.
- Headless behavior decision test: either prove TUI-only lifecycle hooks are intentional or add parity.
- Notification hook loading appears type-supported but was not verified through config loading in this pass.

## Known risks / regressions

- `Stop` is blocking by type, but an agent run has already ended when it fires; blocking can only show an error, not prevent the stop.
- Hook commands run through the shell in the project cwd, so malformed user config can fail or hang until timeout.
- Hook side effects are live-only and are not represented in persisted conversation history.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
