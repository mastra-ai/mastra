# Installation and launch

## Origin PR / commit

- PR: [#13294](https://github.com/mastra-ai/mastra/pull/13294) — installation/startup README guidance for Mastra Code.
- Later changes: [#13560](https://github.com/mastra-ai/mastra/pull/13560) — treats `ERR_STREAM_DESTROYED` as a non-fatal global exception/rejection during CLI runtime.

## User-visible behavior

- What the user can do: install `mastracode` globally or run it with `npx mastracode`.
- Success looks like: `mastracode` launches the TUI, then onboarding guides auth, model packs, OM, and YOLO setup.
- Must preserve: package bin path, ESM startup, workspace dependency assumptions, and first-run setup instructions.

## Entry points / commands

- Commands / shortcuts / flags: `npm install -g mastracode`, `npx mastracode`, `mastracode`.
- Automatic triggers: first launch opens onboarding when setup is incomplete.

## TUI states

- Idle: installed CLI starts the TUI and shows chat/editor/footer.
- Active / modal / error: first-run onboarding can present provider/model/setup dialogs before normal chat.

## Headless / non-TUI behavior

- Supported: installed package also exposes `mastracode --prompt ...` via the same CLI bin.
- Not supported / unknown: install docs do not separately describe headless startup.

## Streaming / loading / interrupted states

- Streaming / loading: launch path must reach the same TUI/headless runtime before streaming begins.
- Abort / retry / resume: startup errors should fail clearly before a run starts; runtime `ERR_STREAM_DESTROYED` exceptions/rejections are ignored as terminal-stream cleanup noise instead of becoming fatal crashes.

## Streaming vs loaded-from-history behavior

- While actively streaming: install path is irrelevant after runtime starts.
- After reload / history reconstruction: installed CLI must still resolve storage/config and resume project threads normally.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Package entry point | `mastracode/package.json` bin/exports | npm/npx/global install |
| Startup runtime | `mastracode/src/main.ts` + `error-classification.ts` | TUI/headless entry, global error handlers |
| Onboarding state | settings/auth storage | First-run setup |
| Install instructions | `mastracode/README.md` | Users and docs readers |

## Key files

- `mastracode/README.md` — current install and usage guidance.
- `mastracode/package.json` — package name, bin path, exports.
- `mastracode/src/main.ts` — CLI/TUI startup path and global uncaught exception / rejection handlers.
- `mastracode/src/error-classification.ts` — classifies `ERR_STREAM_DESTROYED` through causes/AggregateError while leaving real fatal errors to `handleFatalError()`.
- `mastracode/src/headless.ts` — non-TUI prompt mode.

## Dependencies / related features

- [Interactive TUI chat](../tui/interactive-chat.md) — default launched runtime.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — onboarding configures providers/models.
- [Observational memory](../memory/observational-memory.md) — onboarding configures OM.

## Existing tests

- `mastracode/src/__tests__/stream-destroyed-error.test.ts` — unit and subprocess tests for non-fatal `ERR_STREAM_DESTROYED` classification.
- `mastracode/src/main.ts` has remaining behavior covered indirectly through TUI/headless tests.
- No dedicated install/packaged CLI smoke test found.

## Missing tests

- Built package smoke: install/pack, run `mastracode --help` and `mastracode --prompt`.
- Integration test for a real terminal stream closing during active TUI output, not only subprocess detector scripts.
- Global/npx startup test that catches missing workspace dependency builds or bad ESM subpaths.
- First-run onboarding smoke from a clean config dir.

## Known risks / regressions

- Source checkout instructions and published package instructions can diverge.
- Global install can expose ESM/export-map problems not caught by source-mode tests.
- Error classification must stay narrow: swallowing broader stream errors could hide real startup/runtime failures.
- Workspace package build assumptions can break local contributors if docs are stale.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
