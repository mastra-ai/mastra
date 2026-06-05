# Shell passthrough streaming

## Origin PR / commit

- PR: [#13999](https://github.com/mastra-ai/mastra/pull/13999) — stream `!` shell passthrough output in real time instead of buffering until completion.
- Later changes: pending rows include [#15092](https://github.com/mastra-ai/mastra/pull/15092) for collapsible output and [#17283](https://github.com/mastra-ai/mastra/pull/17283) for shell passthrough configuration; revisit this card when those rows are processed.

## User-visible behavior

- What the user can do: type `!<command>` in the TUI to run a local shell command outside the agent/tool-call loop.
- Success looks like: stdout/stderr appear incrementally in a bordered shell component while the subprocess is still running, then the component finishes with success/failure state, duration, and exit-code context.
- Must preserve: real-time streaming, ANSI/color preservation, bounded output growth, non-zero exit diagnostics, and no duplicate buffered stderr after it was already streamed.

## Entry points / commands

- Commands / shortcuts / flags: TUI input beginning with `!`, e.g. `!pnpm test`.
- Automatic triggers: `MastraTUI.run()` routes `userInput.startsWith('!')` to `handleShellPassthrough()`.

## TUI states

- Idle: command is submitted from the normal editor.
- Active / modal / error: `ShellStreamComponent` renders a live bordered block with running/completed/failed status; empty commands show usage info.

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
| Subprocess invocation | `createShellPassthroughSubprocess()` + shell settings | local process runner |
| Live output lines | `ShellStreamComponent` | TUI chat container |
| Completion status | `resolveShellPassthroughCompletion()` | final shell component status |
| Output cap/collapse | `shell-output.ts` constants (`MAX_LINES`, `COLLAPSED_LINES`) | live renderer |

## Key files

- `mastracode/src/tui/mastra-tui.ts` — detects `!` input and dispatches to shell passthrough.
- `mastracode/src/tui/shell.ts` — runs the subprocess and streams stdout/stderr into the component.
- `mastracode/src/tui/components/shell-output.ts` — live bordered output component, status icons, truncation, partial-line handling, collapse/expand state.
- `mastracode/src/tui/shell-runner.ts` — execa invocation, shell selection, timeout, cwd/env handling.
- `mastracode/src/tui/shell-result.ts` — completion/diagnostic resolution.

## Dependencies / related features

- [Interactive chat](./interactive-chat.md) — owns TUI input routing and local component rendering.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — agent `execute_command` is separate from local `!` passthrough and permissioned tool calls.
- [Workspace-backed coding tools](../tools/workspace-tools.md) — workspace shell tools are persisted tool calls; passthrough is local TUI command execution.

## Existing tests

- `mastracode/src/tui/__tests__/shell.test.ts` — shell runner invocation shape, cwd forwarding, explicit shell mode, Windows cmd arguments.
- `mastracode/src/tui/__tests__/shell-result.test.ts` — exit-code/diagnostic resolution for success, spawn failures, timeouts, and already-streamed stderr.

## Missing tests

- Component-level test for `ShellStreamComponent` incremental stdout/stderr rendering, line caps, partial-line flushing, and failure footer.
- End-to-end TUI test proving `!` commands stream before process exit.
- Loaded-history assertion that local passthrough output is not reconstructed as persisted agent/tool history.

## Known risks / regressions

- Streaming both stdout and stderr into one component can reorder bytes relative to the OS streams; tests should only require monotonic per-stream behavior unless ordering is explicitly guaranteed.
- Long-running commands rely on the subprocess timeout and output cap to avoid hanging or unbounded memory growth.
- Future shell-configuration PRs must keep passthrough distinct from agent `execute_command` approval semantics.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
