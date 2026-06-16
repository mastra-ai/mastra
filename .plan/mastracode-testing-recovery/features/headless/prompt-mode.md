# Headless prompt mode

## Origin PR / commit

- PR: [#13648](https://github.com/mastra-ai/mastra/pull/13648) — added non-interactive `--prompt` / `-p` execution for Mastra Code.
- Later changes: [#14962](https://github.com/mastra-ai/mastra/pull/14962) — adds headless thread control flags (`--continue`, `--thread`, `--title`, `--clone-thread`, `--resource-id`) so non-interactive runs can resume, title, clone, and scope threads instead of always starting fresh; [#14909](https://github.com/mastra-ai/mastra/pull/14909) — adds `--model`, shared `--settings`, model availability/API-key preflight, `--model` over `--mode` precedence warnings, and MCP init warning-only behavior for headless startup; [#15423](https://github.com/mastra-ai/mastra/pull/15423) — adds automation-focused `--output-format text|json|stream-json` modes that separate final text summaries, final JSON summaries, and line-delimited event streams; [#16006](https://github.com/mastra-ai/mastra/pull/16006) — expands stdin handling so `--prompt -` still drives headless mode while bare piped stdin drains before interactive TUI startup, and falls back to headless if no TTY can be reopened.

## User-visible behavior

- What the user can do: run `mastracode --prompt "..."` or pipe stdin into `mastracode --prompt -` to execute a task without launching the TUI; bare piped stdin (`cat file.txt | mastracode`) starts the interactive TUI with the sanitized pipe as the first message when a TTY can be reopened; optionally choose an explicit model or mode, use a shared settings file, choose automation output (`text`, `json`, or `stream-json`), resume the latest thread, select a thread by ID/title, clone it, set a title, or set a resource ID.
- Success looks like: assistant text streams to stdout in default mode; tool/subagent/status output goes to stderr; JSON modes emit machine-readable events or a final summary; thread-control actions are announced through stderr/default output or JSON events.
- Must preserve: no interactive terminal assumptions, clear nonzero exits, same Harness/model/workspace behavior as the TUI, and safe auto-resolution of prompts that would otherwise block unattended runs.

## Entry points / commands

- Commands / shortcuts / flags: `--prompt` / `-p`, stdin prompt `-`, `--timeout`, `--format json`, `--output-format text|json|stream-json`, `--model`, `--mode`, `--thinking-level`, `--continue`, `--thread`, `--title`, `--clone-thread`, `--resource-id`, `--settings`.
- Automatic triggers: `main.ts` routes to `headlessMain()` when `hasHeadlessFlag(process.argv)` is true; otherwise non-TTY stdin is drained through `drainPipedStdin()`, stdin is reopened from `/dev/tty`, and the TUI receives the pipe as `initialMessage` (or headless fallback receives the predrained prompt when no TTY is available).

## TUI states

- Idle: not applicable — headless bypasses TUI construction.
- Active / modal / error: modal interactions are auto-resolved through Harness responders instead of rendered inline.

## Headless / non-TUI behavior

- Supported: tool approvals are auto-approved, plan approvals are approved, access requests answer Yes, `ask_user` receives a best-judgment answer, and MCP servers initialize in the background.
- Not supported / unknown: interactive auth/login flows are not available; missing model credentials should fail during preflight.

## Streaming / loading / interrupted states

- Streaming / loading: default output streams assistant deltas; `stream-json` emits Harness events as JSON lines; shell passthrough writes to stderr.
- Abort / retry / resume: timeout calls `harness.abort()` and exits 2; agent `error`/`aborted` exits 1; completed runs exit 0.

## Streaming vs loaded-from-history behavior

- While actively streaming: output is event-driven from the active Harness subscription.
- After reload / history reconstruction: `--continue` resumes the most recently updated thread; `--thread` resolves exact ID first, then title; `--clone-thread` clones before sending the prompt.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Parsed CLI args | `parseHeadlessArgs()` | `headlessMain()`, `runHeadless()` |
| Prompt text | CLI arg, headless drained stdin, or predrained pipe fallback | `harness.sendMessage()` in headless; TUI `initialMessage` when bare pipe can reopen a TTY |
| Output format | `HeadlessArgs.outputFormat` / legacy `format` | stdout/stderr event rendering |
| Model/mode preflight | Parsed `--model` / `--mode` + shared settings/AuthStorage + `harness.listAvailableModels()` | runtime model selection, warnings/errors before `agent_start` |
| Auto-resolution | `autoResolve()` over Harness events | tool approval, plan approval, sandbox access, ask_user |
| Exit code | `agent_end.reason` + timeout flag | CLI process exit |
| Runtime cleanup | `headlessMain()` finally path after `runHeadless()` | thread locks, MCP manager, workers, heartbeats, signals pubsub |
| Thread selection/scoping | `runHeadless()` + Harness thread/resource APIs | `--continue`, `--thread`, `--title`, `--clone-thread`, `--resource-id` |

## Key files

- `mastracode/src/headless.ts` — CLI parsing, usage text (including stdin pipe examples), output formatting, auto-resolution, model/mode/settings preflight, thread/resource selection, title/clone handling, timeout handling, cleanup entry, headless MCP warning behavior, and predrained pipe fallback.
- `mastracode/src/main.ts` — dispatches between TUI and headless startup, drains bare piped stdin before TUI startup, and reopens `/dev/tty` for keyboard input.
- `mastracode/src/utils/stdin-pipe.ts` — sanitizes piped content, drains up to 1MB, zeroes buffers, warns on truncation, and reopens stdin from the controlling TTY.
- `mastracode/src/headless.test.ts` — argument parsing/unit coverage.
- `mastracode/src/headless-integration.test.ts` — Harness lifecycle, tool calls, streaming, and abort integration coverage.

## Dependencies / related features

- [Installation and launch](../setup/installation-and-launch.md) — same package bin and startup runtime.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — `--model`, `--mode`, and auth preflight.
- [Workspace-backed coding tools](../tools/workspace-tools.md) — headless uses the same Workspace tool layer.
- [Plan approval and build handoff](../goals/plan-approval.md) — plan approvals are auto-approved in unattended mode.
- [Interactive prompts and access requests](../tui/interactive-prompts.md) — TUI modals become headless auto-responses.

## Existing tests

- `mastracode/src/headless.test.ts` — flag detection, parsing, validation, timeout/model/mode/thinking/output/output-format arg edge cases, `--settings`, `--clone-thread`, and `--continue` + `--thread` conflict handling.
- `mastracode/src/utils/__tests__/stdin-pipe.test.ts` — ANSI/control-character sanitization, carriage-return overwrite simulation, blank-line collapse, TTY/null cases, async chunk reads, 1MB truncation warning, and buffer zeroing behavior for piped stdin.
- `mastracode/src/headless-integration.test.ts` — real Harness lifecycle, tool call flow, text streaming, abort handling, prompt-context reminders, `--model`/`--mode` preflight and override warnings, missing-key/unknown-model failures, `--output-format text|json|stream-json` stdout/stderr contracts, final JSON summary aggregation, stream-json event output, thread ID/title resume, unknown-thread failure, title rename, and clone event coverage.

## Missing tests

- Packaged CLI smoke for `mastracode --prompt` after npm-style build/install.
- Packaged CLI smoke for model/mode auth preflight through the built binary and real settings/AuthStorage paths.
- Packaged CLI smoke for `cat file.txt | mastracode` proving bare stdin enters TUI mode, reopens the controlling TTY, and preserves keyboard input after the initial message fires.

## Known risks / regressions

- Auto-approving access/tool/plan requests is correct for unattended mode but risky if users expect headless to enforce interactive confirmation.
- Output contracts are easy to regress because humans and scripts consume different streams; `--model` + `--mode` warnings must stay on stderr/default output or JSON warning events without contaminating final text output.
- Thread selection by title uses most-recent match; duplicate titles can still surprise users.
- Bare piped stdin depends on reopening `/dev/tty`; CI or detached terminals fall back to headless mode, so usage docs and tests must keep the split between `--prompt -` and bare pipes explicit.
- Current focused full integration run times out in `can abort a running agent and receive agent_end with aborted reason`; non-abort integration coverage passes when selected explicitly.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.

## TUI e2e recovery evidence

- TUI e2e is explicitly not applicable for this row: headless prompt mode bypasses TUI construction by design and is validated through CLI/headless unit and integration tests.
- Existing break validation covers the user-observable headless contracts: text output buffering, JSON summary output, and stream-json NDJSON event emission.
- Adjacent startup/TUI fallback surfaces remain covered by checked-in TUI e2e scenarios (`startup`, `automated-chat`, and the full e2e suite).
