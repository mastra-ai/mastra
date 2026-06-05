# Headless prompt mode

## Origin PR / commit

- PR: [#13648](https://github.com/mastra-ai/mastra/pull/13648) — added non-interactive `--prompt` / `-p` execution for Mastra Code.
- Later changes: [#14962](https://github.com/mastra-ai/mastra/pull/14962) — adds headless thread control flags (`--continue`, `--thread`, `--title`, `--clone-thread`, `--resource-id`) so non-interactive runs can resume, title, clone, and scope threads instead of always starting fresh. Later queue rows add more model/output flags; current source already includes those surfaces and should be revisited when those rows are processed.

## User-visible behavior

- What the user can do: run `mastracode --prompt "..."` or pipe stdin into `mastracode --prompt -` to execute a task without launching the TUI; optionally resume the latest thread, select a thread by ID/title, clone it, set a title, or set a resource ID.
- Success looks like: assistant text streams to stdout in default mode; tool/subagent/status output goes to stderr; JSON modes emit machine-readable events or a final summary; thread-control actions are announced through stderr/default output or JSON events.
- Must preserve: no interactive terminal assumptions, clear nonzero exits, same Harness/model/workspace behavior as the TUI, and safe auto-resolution of prompts that would otherwise block unattended runs.

## Entry points / commands

- Commands / shortcuts / flags: `--prompt` / `-p`, stdin prompt `-`, `--timeout`, `--format json`, `--output-format text|json|stream-json`, `--model`, `--mode`, `--thinking-level`, `--continue`, `--thread`, `--title`, `--clone-thread`, `--resource-id`, `--settings`.
- Automatic triggers: `main.ts` routes to `headlessMain()` when `hasHeadlessFlag(process.argv)` is true.

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
| Prompt text | CLI arg or drained stdin | `harness.sendMessage()` |
| Output format | `HeadlessArgs.outputFormat` / legacy `format` | stdout/stderr event rendering |
| Auto-resolution | `autoResolve()` over Harness events | tool approval, plan approval, sandbox access, ask_user |
| Exit code | `agent_end.reason` + timeout flag | CLI process exit |
| Runtime cleanup | `headlessMain()` finally path after `runHeadless()` | thread locks, MCP manager, workers, heartbeats, signals pubsub |
| Thread selection/scoping | `runHeadless()` + Harness thread/resource APIs | `--continue`, `--thread`, `--title`, `--clone-thread`, `--resource-id` |

## Key files

- `mastracode/src/headless.ts` — CLI parsing, usage text, output formatting, auto-resolution, thread/resource selection, title/clone handling, timeout handling, cleanup entry.
- `mastracode/src/main.ts` — dispatches between TUI and headless startup.
- `mastracode/src/headless.test.ts` — argument parsing/unit coverage.
- `mastracode/src/headless-integration.test.ts` — Harness lifecycle, tool calls, streaming, and abort integration coverage.

## Dependencies / related features

- [Installation and launch](../setup/installation-and-launch.md) — same package bin and startup runtime.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — `--model`, `--mode`, and auth preflight.
- [Workspace-backed coding tools](../tools/workspace-tools.md) — headless uses the same Workspace tool layer.
- [Plan approval and build handoff](../goals/plan-approval.md) — plan approvals are auto-approved in unattended mode.
- [Interactive prompts and access requests](../tui/interactive-prompts.md) — TUI modals become headless auto-responses.

## Existing tests

- `mastracode/src/headless.test.ts` — flag detection, parsing, validation, timeout/mode/thinking/output arg edge cases, `--clone-thread`, and `--continue` + `--thread` conflict handling.
- `mastracode/src/headless-integration.test.ts` — real Harness lifecycle, tool call flow, text streaming, abort handling, prompt-context reminders, model/mode preflight, thread ID/title resume, unknown-thread failure, title rename, and clone event coverage.

## Missing tests

- Packaged CLI smoke for `mastracode --prompt` after npm-style build/install.
- Headless auth failure path for missing credentials on explicit `--model` or configured `--mode`.
- End-to-end JSON/stream-json contract tests that assert stdout/stderr separation, including thread-control status/event output.

## Known risks / regressions

- Auto-approving access/tool/plan requests is correct for unattended mode but risky if users expect headless to enforce interactive confirmation.
- Output contracts are easy to regress because humans and scripts consume different streams.
- Thread selection by title uses most-recent match; duplicate titles can still surprise users.
- Current focused full integration run times out in `can abort a running agent and receive agent_end with aborted reason`; non-abort integration coverage passes when selected explicitly.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
