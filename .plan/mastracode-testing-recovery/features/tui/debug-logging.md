# Debug logging

## Origin PR / commit

- PR: [#13691](https://github.com/mastra-ai/mastra/pull/13691) — gates `debug.log` behind `MASTRA_DEBUG` and caps retained log size.

## User-visible behavior

- What the user can do: run with `MASTRA_DEBUG=true` or `MASTRA_DEBUG=1` to capture `console.error`/`console.warn` output in the app-data `debug.log` file.
- Success looks like: normal TUI/headless runs do not create or grow `debug.log`, while opt-in debug runs preserve useful warning/error output including Error stack traces.
- Must preserve: default console suppression still protects the TUI from raw stderr noise.

## Entry points / commands

- Commands / shortcuts / flags: `MASTRA_DEBUG=true mastracode`, `MASTRA_DEBUG=1 mastracode --prompt ...`.
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
| Log path | `getAppDataDir()/debug.log` | TUI/headless debug capture |
| Log cap | `truncateLogFile()` (`MAX_LOG_SIZE` 5 MB, keep ~4 MB) | startup debug setup |
| Console warning/error sinks | overridden `console.error` / `console.warn` | runtime diagnostics |

## Key files

- `mastracode/src/utils/debug-log.ts` — debug enablement, file truncation, stack-aware formatting, console override.
- `mastracode/src/utils/__tests__/debug-log.test.ts` — unit coverage for size cap, env gating, and stack logging.
- `mastracode/src/main.ts` — TUI startup calls `setupDebugLogging()`.
- `mastracode/src/headless.ts` — headless startup calls `setupDebugLogging()`.

## Dependencies / related features

- [Installation and launch](../setup/installation-and-launch.md) — startup path owns debug setup.
- [Interactive TUI chat](./interactive-chat.md) — console suppression protects the terminal UI while chat renders.

## Existing tests

- `mastracode/src/utils/__tests__/debug-log.test.ts` — 8 tests covering no-op below cap, truncation above cap, newline-boundary truncation, missing file handling, default/`false` suppression, `true`/`1` file logging, and Error stack formatting.

## Missing tests

- Startup integration test proving `main.ts` and `headless.ts` both call `setupDebugLogging()` exactly once in representative runs.
- Test proving repeated debug sessions append to the same file after truncation without corrupting partial lines.

## Known risks / regressions

- Overriding global console methods can hide diagnostics if `MASTRA_DEBUG` is unset during test or development sessions.
- `debug.log` is capped only at setup time; a single long-running session can still grow beyond the cap before the next launch.
- Later TUI-specific debug paths must avoid conflicting env vars or writing uncapped files.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
