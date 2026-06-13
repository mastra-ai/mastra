# Installation and launch

## Origin PR / commit

- PR: [#13294](https://github.com/mastra-ai/mastra/pull/13294) — installation/startup README guidance for Mastra Code.
- Later changes: [#13560](https://github.com/mastra-ai/mastra/pull/13560) — treats `ERR_STREAM_DESTROYED` as a non-fatal global exception/rejection during CLI runtime; [#13691](https://github.com/mastra-ai/mastra/pull/13691) — makes debug logging opt-in via `MASTRA_DEBUG` and caps app-data `debug.log`; [#13603](https://github.com/mastra-ai/mastra/pull/13603) — checks for newer npm versions on TUI startup and prompts for update; [#13648](https://github.com/mastra-ai/mastra/pull/13648) — adds non-interactive headless startup through `--prompt`; [#13760](https://github.com/mastra-ai/mastra/pull/13760) — inlines package version metadata at build time to avoid runtime `package.json` dependency in npm installs; [#13767](https://github.com/mastra-ai/mastra/pull/13767) and [#13768](https://github.com/mastra-ai/mastra/pull/13768) — keep direct source runs working with an ESM-safe package metadata fallback; [#14541](https://github.com/mastra-ai/mastra/pull/14541) — replaces `latest` package dependency specifiers with explicit semver ranges for reproducible installs; [#14586](https://github.com/mastra-ai/mastra/pull/14586) — starts macOS `caffeinate` only during active agent runs so long tasks do not let the machine sleep.

## User-visible behavior

- What the user can do: install `mastracode` globally or run it with `npx mastracode`; on macOS, active agent runs keep the machine awake automatically.
- Success looks like: `mastracode` launches the TUI, onboarding guides auth/model setup, and long active runs do not sleep until the run ends.
- Must preserve: package bin path, ESM startup, workspace dependency assumptions, first-run setup instructions, and no keep-awake side effects while idle.

## Entry points / commands

- Commands / shortcuts / flags: `npm install -g mastracode`, `npx mastracode`, `mastracode`, `MASTRACODE_DISABLE_CAFFEINATE=1`.
- Automatic triggers: first launch opens onboarding when setup is incomplete; macOS `agent_start` spawns `caffeinate -i -m` unless disabled, and `agent_end`/TUI stop kills it.

## TUI states

- Idle: installed CLI starts the TUI and shows chat/editor/footer without a keep-awake process.
- Active / modal / error: first-run onboarding can present provider/model/setup dialogs before normal chat; active agent runs own a transient `caffeinate` child process on macOS.

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
| Dependency ranges | `mastracode/package.json` + `pnpm-lock.yaml` | npm/npx/global install reproducibility, package-manager resolution |
| Package version detection | `tsup.config.ts` `MASTRACODE_VERSION` define + ESM-safe source fallback | `getCurrentVersion()`, analytics, startup/update UI |
| Startup runtime | `mastracode/src/main.ts` + `headless.ts` + `error-classification.ts` + `utils/debug-log.ts` | TUI/headless entry, global error handlers, debug logging |
| macOS sleep-prevention process | `MastraTUI.caffeinateProcess` from `agent_start`/`agent_end`, gated by platform and `MASTRACODE_DISABLE_CAFFEINATE` | Active TUI runs, `stop()` cleanup |
| Onboarding state | settings/auth storage | First-run setup |
| Install instructions | `mastracode/README.md` | Users and docs readers |

## Key files

- `mastracode/README.md` — current install and usage guidance.
- `mastracode/package.json` — package name, bin path, exports, and explicit dependency semver ranges.
- `mastracode/tsup.config.ts` — build-time `MASTRACODE_VERSION` injection for packaged startup.
- `mastracode/src/main.ts` — CLI/TUI startup path and global uncaught exception / rejection handlers.
- `mastracode/src/tui/mastra-tui.ts` — macOS `caffeinate` child-process lifecycle for active TUI agent runs.
- `mastracode/src/error-classification.ts` — classifies `ERR_STREAM_DESTROYED` through causes/AggregateError while leaving real fatal errors to `handleFatalError()`.
- `mastracode/src/headless.ts` — non-TUI prompt mode.
- `mastracode/src/utils/debug-log.ts` — startup console warning/error suppression or debug-file redirection.

## Dependencies / related features

- [Interactive TUI chat](../tui/interactive-chat.md) — default launched runtime.
- [Headless prompt mode](../headless/prompt-mode.md) — non-interactive CLI startup path.
- [Debug logging](../tui/debug-logging.md) — startup debug-file behavior for TUI and headless runs.
- [Lifecycle hooks](../integrations/lifecycle-hooks.md) — shares live `agent_start`/`agent_end` lifecycle ownership with macOS sleep prevention.
- [Auto-update prompts](./auto-update-prompts.md) — startup version-check prompt and dismissed-version settings.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — onboarding configures providers/models.
- [Observational memory](../memory/observational-memory.md) — onboarding configures OM.

## Existing tests

- `mastracode/src/__tests__/stream-destroyed-error.test.ts` — unit and subprocess tests for non-fatal `ERR_STREAM_DESTROYED` classification.
- `mastracode/src/tui/__tests__/mastra-tui-hooks.test.ts` — verifies macOS `caffeinate` start, duplicate suppression, stop on all agent endings, `stop()` cleanup, non-Darwin no-op, and env-var disable.
- `mastracode/src/main.ts` has remaining behavior covered indirectly through TUI/headless tests.
- `mastracode/src/__tests__/package-metadata.test.ts` — static package smoke for installed CLI bin path, public exports, publish files, Node engine, no `latest` dependency ranges, plus a built-CLI smoke that runs the package `bin` entrypoint for `--help` and headless `--prompt` validation.
- `mastracode/scripts/mc-e2e/scenarios/first-run-onboarding.ts` — partial TUI e2e coverage for clean-config first launch: removes seeded settings/auth before startup, verifies the first-run welcome overlay appears, selects Skip through real key input, and asserts the normal TUI prompt returns.

## Missing tests

- Deferred: true global/npx startup smoke against a packed registry artifact, because it requires package-manager install/network lifecycle outside the hermetic test harness.
- Deferred: integration test for a real terminal stream closing during active TUI output, not only subprocess detector scripts.

## Known risks / regressions

- Source checkout instructions and published package instructions can diverge.
- Global install can expose ESM/export-map problems not caught by source-mode tests.
- Error classification must stay narrow: swallowing broader stream errors could hide real startup/runtime failures.
- Workspace package build assumptions can break local contributors if docs are stale.
- Dependency pins protect published installs, but broad package checks can still fail from unrelated existing TypeScript/test baseline issues.
- Keep-awake cleanup must run through every `agent_end` and `stop()` path; leaking `caffeinate` would keep a Mac awake after Mastra Code is idle or closed.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
