# Browser automation

## Origin PR / commit

- PR: [#15036](https://github.com/mastra-ai/mastra/pull/15036) — added configurable browser automation support for Mastra Code agents.
- Later changes: none known.

## User-visible behavior

- What the user can do: run `/browser` to inspect, enable, disable, or configure browser automation using Stagehand or Agent Browser, including headless mode, viewport, CDP connection, executable path, profile persistence, and storage-state export.
- Success looks like: settings persist in `settings.json`, enabled browser instances attach to all mode agents, `/browser status` reports the active configuration, and browser tools/context are available during agent runs.
- Must preserve: provider mismatch warnings for reused profiles, mutual exclusion between CDP/executable/profile launch modes, Browserbase env requirements, and safe cleanup of profile lock files.

## Entry points / commands

- Commands / shortcuts / flags: `/browser`, `/browser status`, `/browser on`, `/browser off`, `/browser set ...`, `/browser clear ...`, `/browser export storageState <path>`.
- Automatic triggers: startup calls `createBrowserFromSettings(settings.browser)` when browser settings are enabled, then `harness.setBrowser(browser)` and stores `activeBrowserSettings` in Harness state.

## TUI states

- Idle: `/browser` opens the setup wizard or quick command flow and writes settings.
- Active / modal / error: browser settings can be changed through command handlers; active mode agents are hot-swapped via `Agent.setBrowser()` after successful configuration.

## Headless / non-TUI behavior

- Supported: `createMastraCode({ browser })` can provide a Harness-level browser, and core `Agent` execution injects browser context dynamically.
- Not supported / unknown: no dedicated headless CLI flag for toggling saved browser settings was verified.

## Streaming / loading / interrupted states

- Streaming / loading: browser context is attached at agent execution time; browser state lookup failure degrades without aborting the run.
- Abort / retry / resume: browser sessions are runtime state; persisted chat history does not reconstruct live browser instances.

## Streaming vs loaded-from-history behavior

- While actively streaming: browser tools/context are available to the current agent run based on active browser configuration.
- After reload / history reconstruction: saved browser settings can recreate a browser at startup, but old tool/browser state is not replayed from message history.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Browser settings | Global `settings.json` `browser` block parsed by `parseBrowserSettings()` | `/browser`, startup browser creation |
| Active browser instance | Harness-level `browser` from config/startup or `/browser` hot-swap | Mode agents, core Agent execution |
| Active settings projection | Harness state `activeBrowserSettings` | `/browser status`, config drift checks |
| Profile provider marker | Profile metadata written by `/browser` | Provider mismatch confirmation |
| Browser session scope | Browser settings `scope` plus provider implementation | Core Agent browser context/session IDs |

## Key files

- `mastracode/src/tui/commands/browser.ts` — `/browser` status, quick commands, interactive wizard, clear/export flows, provider mismatch guard, and agent hot-swap.
- `mastracode/src/onboarding/settings.ts` — `BrowserSettings`, provider/env validation, defaults, and `createBrowserFromSettings()`.
- `mastracode/src/main.ts` — startup loading of saved browser settings into Harness.
- `mastracode/src/index.ts` — `MastraCodeConfig.browser` pass-through to Harness.
- `packages/core/src/harness/harness.ts` — Harness-level browser storage and propagation to mode agents.
- `packages/core/src/agent/__tests__/browser.test.ts` — Agent browser context behavior.
- `packages/core/src/browser/browser.test.ts` — profile lock cleanup and process-group kill helpers.

## Dependencies / related features

- [Onboarding and global settings](../settings/onboarding-and-global-settings.md) — browser configuration persists in global settings.
- [Help and shortcuts](../tui/help-and-shortcuts.md) — `/browser` appears in help output.
- [Core Harness API](./harness-api.md) — Harness owns browser propagation to agents.
- [Workspace-backed coding tools](../tools/workspace-tools.md) — browser tools are runtime tools, not workspace file tools.

## Existing tests

- `packages/core/src/agent/__tests__/browser.test.ts` — browser getter, execution context injection, thread-aware session IDs, and degraded state lookup.
- `packages/core/src/browser/browser.test.ts` — Chrome lock-file cleanup and process-group kill helper behavior.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` — `/browser` command dispatch is mocked in command routing coverage.

## Missing tests

- Direct `/browser` command/wizard tests for provider selection, Browserbase requirements, CDP/profile/executable mutual exclusion, clear/export flows, and saved settings.
- Startup regression proving saved browser settings create a browser and set `activeBrowserSettings`.
- TUI status/config-drift tests for profile provider mismatch warnings.
- End-to-end agent run proving browser tools/context are available from saved settings in Mastra Code.

## Known risks / regressions

- Browser command behavior is broad but has little direct MastraCode TUI test coverage; most current proof is core Agent/browser tests plus command dispatch routing.
- `activeBrowserSettings` in Mastra Code state schema is narrower than full `BrowserSettings`; profile, executable path, storage-state, and agent-browser subsettings are persisted globally but not fully projected into Harness state.
- Profile reuse can break if Chrome lock cleanup or provider mismatch metadata drifts.
- Provider behavior differs significantly between Stagehand local, Stagehand Browserbase, and Agent Browser.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
