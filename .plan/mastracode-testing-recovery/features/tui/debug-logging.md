# Debug logging

## Origin PR / commit

- PR: [#13691](https://github.com/mastra-ai/mastra/pull/13691) — gates `debug.log` behind `MASTRA_DEBUG` and caps retained log size.
- Later changes: [#13701](https://github.com/mastra-ai/mastra/pull/13701) — split assistant-message/TUI component debug output onto `MASTRA_TUI_DEBUG` so it does not collide with global `MASTRA_DEBUG`.

## User-visible behavior

- What the user can do: run with `MASTRA_DEBUG=true` or `MASTRA_DEBUG=1` to capture `console.error`/`console.warn` output in the app-data `debug.log` file; use `MASTRA_TUI_DEBUG=true` or `1` for assistant-message component traces in `tui-debug.log`.
- Success looks like: normal TUI/headless runs do not create or grow `debug.log`, while opt-in debug runs preserve useful warning/error output including Error stack traces; TUI component tracing is separately opt-in.
- Must preserve: default console suppression still protects the TUI from raw stderr noise, and global debug logging must not accidentally enable verbose assistant-message component logs.

## Entry points / commands

- Commands / shortcuts / flags: `MASTRA_DEBUG=true mastracode`, `MASTRA_DEBUG=1 mastracode --prompt ...`, `MASTRA_TUI_DEBUG=1 mastracode`.
- Automatic triggers: `setupDebugLogging()` runs during TUI startup (`main.ts`) and headless startup (`headless.ts`).

## TUI states

- Idle: no visible UI state; logging is a startup/runtime side effect.
- Active / modal / error: warnings/errors are either silenced or appended to `debug.log`, never printed into the terminal UI.

## Headless / non-TUI behavior

- Supported: headless calls the same `setupDebugLogging()` helper before harness init.
- Not supported / unknown: no separate headless-specific log destination; app-data `debug.log` is shared.

## Streaming / loading / interrupted states

- Streaming / loading: log capture should not interfere with message/tool streaming.
- Abort / retry / resume: truncation happens once at setup time if an existing file exceeds 5 MB.

## Streaming vs loaded-from-history behavior

- While actively streaming: runtime warnings/errors may be appended when debug logging is enabled.
- After reload / history reconstruction: debug log state is out-of-band and does not affect persisted chat history.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Debug enablement | `process.env.MASTRA_DEBUG` (`true` or `1`) | `setupDebugLogging()` |
| TUI component debug enablement | `process.env.MASTRA_TUI_DEBUG` (`true` or `1`) | Assistant-message trace helper |
| Log path | `getAppDataDir()/debug.log` | TUI/headless debug capture |
| TUI trace path | `process.cwd()/tui-debug.log` | Assistant-message component diagnostics |
| Log cap | `truncateLogFile()` (`MAX_LOG_SIZE` 5 MB, keep ~4 MB) | startup debug setup |
| Console warning/error sinks | overridden `console.error` / `console.warn` | runtime diagnostics |

## Key files

- `mastracode/src/utils/debug-log.ts` — debug enablement, file truncation, stack-aware formatting, console override.
- `mastracode/src/utils/__tests__/debug-log.test.ts` — unit coverage for size cap, env gating, and stack logging.
- `mastracode/src/main.ts` — TUI startup calls `setupDebugLogging()`.
- `mastracode/src/headless.ts` — headless startup calls `setupDebugLogging()`.
- `mastracode/src/tui/components/assistant-message.ts` — assistant-message component trace logging behind `MASTRA_TUI_DEBUG`.

## Dependencies / related features

- [Installation and launch](../setup/installation-and-launch.md) — startup path owns debug setup.
- [Interactive TUI chat](./interactive-chat.md) — console suppression protects the terminal UI while chat renders.

## Existing tests

- `mastracode/src/utils/__tests__/debug-log.test.ts` — covers no-op below cap, truncation above cap, newline-boundary truncation, missing file handling, default/`false` suppression, `true`/`1` file logging, Error stack formatting, and repeated debug sessions appending after truncation without partial lines.

## Missing tests

- Partial e2e coverage exists: `debug-logging` launches a real TUI via a custom entrypoint with `MASTRA_DEBUG=1`, calls `setupDebugLogging()`, emits a sentinel `console.warn`, verifies the sentinel does not leak into the terminal UI, and asserts the isolated app-data `debug.log` contains `[WARN]` plus the sentinel.
- Startup integration test proving `main.ts` and `headless.ts` both call `setupDebugLogging()` exactly once in representative production runs; the e2e scenario covers the helper behavior through a TUI launch but uses a custom entrypoint seam for deterministic sentinel emission.

## Known risks / regressions

- Overriding global console methods can hide diagnostics if `MASTRA_DEBUG` is unset during test or development sessions.
- `debug.log` is capped only at setup time; a single long-running session can still grow beyond the cap before the next launch.
- TUI-specific `tui-debug.log` is separate from app-data `debug.log` and currently writes in `process.cwd()` without the same 5 MB truncation path.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
