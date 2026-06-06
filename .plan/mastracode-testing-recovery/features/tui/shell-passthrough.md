# Shell passthrough streaming

## Origin PR / commit

- PR: [#13999](https://github.com/mastra-ai/mastra/pull/13999) — stream `!` shell passthrough output in real time instead of buffering until completion.
- Later changes: [#15092](https://github.com/mastra-ai/mastra/pull/15092) — makes `!` passthrough output collapsible via the shared Ctrl+E tool-output toggle, caps the live component at 200 stored lines / 20 visible collapsed lines, tracks shell components in TUI state, and clears them on thread/resource switches and chat pruning; [#15566](https://github.com/mastra-ai/mastra/pull/15566) — hardens shared ANSI/OSC truncation against polynomial ReDoS while preserving visible-width truncation for shell/tool renderers; [#17283](https://github.com/mastra-ai/mastra/pull/17283) — adds configurable shell passthrough invocation via settings and `MASTRACODE_SHELL` / `MASTRACODE_SHELL_MODE`, including POSIX, cmd.exe, and PowerShell command builders.

## User-visible behavior

- What the user can do: type `!<command>` in the TUI to run a local shell command outside the agent/tool-call loop, using either the platform default shell or a configured shell executable/mode from settings or `MASTRACODE_SHELL` / `MASTRACODE_SHELL_MODE`.
- Success looks like: stdout/stderr appear incrementally in a bordered shell component while the subprocess is still running, long output stays collapsed to the latest 20 lines by default, Ctrl+E expands/collapses shell output with other tool-like blocks, configured shells are invoked with the right family-specific args (`-c`, `/d /s /c`, or PowerShell `-EncodedCommand`), then the component finishes with success/failure state, duration, and exit-code context.
- Must preserve: real-time streaming, ANSI/color preservation through bounded ANSI/OSC parsing, bounded output growth, collapse/expand parity with tool output, non-zero exit diagnostics, no duplicate buffered stderr after it was already streamed, and fallback to default shell with warnings for invalid explicit shell config.

## Entry points / commands

- Commands / shortcuts / flags: TUI input beginning with `!`, e.g. `!pnpm test`; Ctrl+E toggles collapsed/expanded passthrough output after [#15092](https://github.com/mastra-ai/mastra/pull/15092); `MASTRACODE_SHELL` overrides the shell executable and `MASTRACODE_SHELL_MODE` selects `default`, `path`, or `login`; persisted `shellPassthrough` settings can also specify `mode`, `executable`, and `family`.
- Automatic triggers: `MastraTUI.run()` routes `userInput.startsWith('!')` to `handleShellPassthrough()`.

## TUI states

- Idle: command is submitted from the normal editor; shell components inherit the global `toolOutputExpanded` state when created.
- Active / modal / error: `ShellStreamComponent` renders a live bordered block with running/completed/failed status; empty commands show usage info; Ctrl+E calls `setExpanded()` on all tracked shell components.

## Headless / non-TUI behavior

- Supported: headless prompt mode writes shell passthrough events to stderr when they occur in the headless event stream.
- Not supported / unknown: the interactive `!` prefix is TUI input routing, not a headless CLI flag.

## Streaming / loading / interrupted states

- Streaming / loading: `subprocess.stdout` and `subprocess.stderr` `data` events append directly to the live component.
- Abort / retry / resume: subprocess completion is resolved by `resolveShellPassthroughCompletion()`; spawn failures/timeouts finish the component with exit code 1 and a diagnostic.

## Streaming vs loaded-from-history behavior

- While actively streaming: partial lines are buffered until newline and output is capped to the latest 200 lines with a collapsed 20-line view.
- After reload / history reconstruction: passthrough shell output is local TUI state, not persisted conversation history like agent tool calls.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Passthrough command | TUI input router | `handleShellPassthrough()` |
| Subprocess invocation | `createShellPassthroughSubprocess()` + `resolveShellPassthroughInvocation()` + persisted/env shell settings | local process runner |
| Live output lines | `ShellStreamComponent` | TUI chat container |
| Completion status | `resolveShellPassthroughCompletion()` | final shell component status |
| Shell config | `settings.json.shellPassthrough`, `MASTRACODE_SHELL`, `MASTRACODE_SHELL_MODE` | `handleShellPassthrough()`, `/help` shell label, `createShellPassthroughSubprocess()` |
| Output cap/collapse | `shell-output.ts` constants (`MAX_LINES`, `COLLAPSED_LINES`) | live renderer |

## Key files

- `mastracode/src/tui/mastra-tui.ts` — detects `!` input and dispatches to shell passthrough.
- `mastracode/src/tui/shell.ts` — loads shell passthrough settings, runs the subprocess, surfaces config warnings, and streams stdout/stderr into the component.
- `mastracode/src/tui/components/shell-output.ts` — live bordered output component, status icons, truncation, partial-line handling, collapse/expand state.
- `mastracode/src/tui/components/ansi.ts` — shared bounded ANSI/OSC truncation helper used by shell/tool renderers.
- `mastracode/src/tui/shell-config.ts` — shell mode/family resolution, env override handling, POSIX/cmd/PowerShell argument builders, labels, and warnings.
- `mastracode/src/tui/shell-runner.ts` — execa invocation, explicit/default shell selection, timeout, cwd/env handling, and Windows verbatim-argument handling for cmd.exe.
- `mastracode/src/tui/shell-result.ts` — completion/diagnostic resolution.

## Dependencies / related features

- [Interactive chat](./interactive-chat.md) — owns TUI input routing and local component rendering.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — agent `execute_command` is separate from local `!` passthrough and permissioned tool calls.
- [Workspace-backed coding tools](../tools/workspace-tools.md) — workspace shell tools are persisted tool calls; passthrough is local TUI command execution.
- [Onboarding and global settings](../settings/onboarding-and-global-settings.md) — persists `shellPassthrough` defaults for the local runner.

## Existing tests

- `mastracode/src/tui/__tests__/shell-config.test.ts` — shell mode/family resolution, env overrides, POSIX/cmd/PowerShell arg building, invalid-config fallbacks, and PowerShell exit-code wrapper behavior.
- `mastracode/src/tui/__tests__/shell.test.ts` — shell runner invocation shape, cwd forwarding, explicit shell mode, Windows cmd arguments.
- `mastracode/src/tui/__tests__/shell-result.test.ts` — exit-code/diagnostic resolution for success, spawn failures, timeouts, and already-streamed stderr.
- `mastracode/src/tui/__tests__/prune-chat.test.ts` — verifies `allShellComponents` are removed when pruned chat children are discarded.
- `mastracode/src/tui/__tests__/setup-keyboard-shortcuts.test.ts` — covers Ctrl+E expansion for tracked components; current assertion is system-reminder focused, while shell components use the same loop.
- `mastracode/src/tui/components/__tests__/ansi.test.ts` — covers ANSI/OSC truncation plus a pathological no-terminator ReDoS regression case.
- `mastracode/src/tui/components/__tests__/shell-output.test.ts` — covers `ShellStreamComponent` incremental output rendering, trailing partial flush on finish, failure footer/exit code, 20-line collapsed view, 200-line cap, expanded view, and terminal-width truncation.
- `mastracode/scripts/mc-e2e/scenarios/modal-and-shell.ts` — partial real PTY coverage: submits a default-shell `!printf` passthrough command, asserts bordered stdout is rendered as shell output, and asserts the success footer appears after completion.

## Missing tests

- End-to-end PTY test proving configured `MASTRACODE_SHELL`/settings modes run the same visible `!` command path as default shell mode.
- End-to-end TUI test proving long-running `!` commands stream before process exit; the current PTY scenario covers completed stdout rendering and footer state only.
- Loaded-history assertion that local passthrough output is not reconstructed as persisted agent/tool history.

## Known risks / regressions

- Streaming both stdout and stderr into one component can reorder bytes relative to the OS streams; tests should only require monotonic per-stream behavior unless ordering is explicitly guaranteed.
- Long-running commands rely on the subprocess timeout, 200-line component cap, and chat pruning to avoid hanging or unbounded memory growth.
- Shell component tracking must be cleared on thread/resource switches; stale components would make Ctrl+E mutate output from another thread.
- Shell passthrough configuration must keep local `!` commands distinct from agent `execute_command` approval semantics, even when both execute shell text.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
