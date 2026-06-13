# Browser automation

## Origin PR / commit

- PR: [#15036](https://github.com/mastra-ai/mastra/pull/15036) — added configurable browser automation support for Mastra Code agents.
- Later changes: [#15194](https://github.com/mastra-ai/mastra/pull/15194) — adds browser `profile` and `executablePath` launch options, CDP/profile/executable mutual exclusion, profile provider mismatch checks, storage-state export, and profile lock cleanup helpers; [#17240](https://github.com/mastra-ai/mastra/pull/17240) — turns browser context into a processor-backed `browser` state-signal lane with snapshots/deltas and live-state refresh.

## User-visible behavior

- What the user can do: run `/browser` to inspect, enable, disable, or configure browser automation using Stagehand or Agent Browser, including headless mode, viewport, CDP connection, custom executable path, profile persistence, and Agent Browser storage-state export.
- Success looks like: settings persist in `settings.json`, enabled browser instances attach to all mode agents, `/browser status` reports the active configuration, browser tools/context are available during agent runs, and browser open/tab/title/url changes can be emitted as deduped state snapshots or deltas.
- Must preserve: provider mismatch warnings for reused profiles, mutual exclusion between CDP and launch-time profile/executable options, Browserbase env requirements, profile directory creation/lock cleanup, and storage-state export limited to Agent Browser.

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

- Streaming / loading: browser context is attached at agent execution time; `BrowserContextProcessor.computeStateSignal()` can refresh live browser state via `getState()` and stream a `browser` state snapshot/delta before the model request finalizes.
- Abort / retry / resume: browser sessions are runtime state; persisted chat history does not reconstruct live browser instances.

## Streaming vs loaded-from-history behavior

- While actively streaming: browser tools/context are available to the current agent run based on active browser configuration.
- After reload / history reconstruction: saved browser settings can recreate a browser at startup, but old tool/browser state is not replayed from message history.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Browser settings | Global `settings.json` `browser` block parsed by `parseBrowserSettings()`, including `profile`, `executablePath`, `cdpUrl`, `scope`, Stagehand, and Agent Browser subsettings | `/browser`, startup browser creation |
| Active browser instance | Harness-level `browser` from config/startup or `/browser` hot-swap | Mode agents, core Agent execution |
| Active settings projection | Harness state `activeBrowserSettings` | `/browser status`, config drift checks |
| Profile provider marker | Profile metadata written by `/browser` when profile persistence is enabled | Provider mismatch confirmation |
| Browser session scope | Browser settings `scope` plus provider implementation | Core Agent browser context/session IDs |
| Browser state signal | `BrowserContextProcessor.stateId = 'browser'` + request-context browser state | processor state signals, TUI `State snapshot/delta: browser` rows, thread metadata tracking |

## Key files

- `mastracode/src/tui/commands/browser.ts` — `/browser` status, quick commands, interactive wizard, `set`/`clear`/export flows, CDP/profile/executable mutual exclusion, provider mismatch guard, and agent hot-swap.
- `mastracode/src/onboarding/settings.ts` — `BrowserSettings`, provider/env/profile/executable validation, defaults, profile provider metadata, and `createBrowserFromSettings()`.
- `mastracode/src/main.ts` — startup loading of saved browser settings into Harness.
- `mastracode/src/index.ts` — `MastraCodeConfig.browser` pass-through to Harness.
- `packages/core/src/harness/harness.ts` — Harness-level browser storage and propagation to mode agents.
- `packages/core/src/agent/__tests__/browser.test.ts` — Agent browser context behavior.
- `packages/core/src/browser/processor.test.ts` — browser state-signal snapshots, metadata-backed deltas, live-state refresh, and snapshot refresh when prior snapshots fall out of the active context window.
- `packages/core/src/browser/browser.ts` and `browser.test.ts` — profile/executable option contract, Chrome lock-file cleanup, and process-group kill helpers.

## Dependencies / related features

- [Onboarding and global settings](../settings/onboarding-and-global-settings.md) — browser configuration persists in global settings.
- [Help and shortcuts](../tui/help-and-shortcuts.md) — `/browser` appears in help output.
- [Core Harness API](./harness-api.md) — Harness owns browser propagation to agents.
- [Workspace-backed coding tools](../tools/workspace-tools.md) — browser tools are runtime tools, not workspace file tools.

## Existing tests

- `packages/core/src/agent/__tests__/browser.test.ts` — browser getter, execution context injection, thread-aware session IDs, and degraded state lookup.
- `packages/core/src/browser/browser.test.ts` — Chrome lock-file cleanup and process-group kill helper behavior for profile-backed browser launches.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` — `/browser` command dispatch is mocked in command routing coverage.
- `mastracode/src/tui/commands/__tests__/browser.test.ts` — direct `/browser on` shield proving enabled settings create a browser, attach it to static and state-derived mode agents, record `activeBrowserSettings`, and persist profile provider metadata.
- `mastracode/scripts/mc-e2e/scenarios/integration-commands.ts` — real PTY/TUI e2e partial coverage proving `/browser status` renders visible browser status feedback in the transcript.
- `mastracode/scripts/mc-e2e/scenarios/browser-settings-persistence.ts` — real PTY/TUI e2e partial coverage for `/browser set cdpUrl`, `/browser set profile`, `/browser set executablePath`, `/browser clear profile`, and `/browser clear`, including persisted settings assertions for CDP/profile mutual exclusion, profile cleanup, executable persistence, and clear-all default reset.
- `mastracode/scripts/mc-e2e/scenarios/browser-toggle-attach.ts` — real PTY/TUI e2e coverage for `/browser on` with an AgentBrowser CDP configuration, `/browser status` enabled projection, saved settings persistence, and provider-visible browser tool injection in a subsequent AIMock turn.
- `mastracode/scripts/mc-e2e/scenarios/browser-startup-restore.ts` — real PTY/TUI e2e coverage for enabled AgentBrowser/CDP settings restored during startup without `/browser on`, including `/browser status` projection and model-visible browser context/tool injection in the first AIMock turn.
- `mastracode/scripts/mc-e2e/scenarios/browser-wizard-export.ts` — real PTY/TUI e2e coverage for the full interactive `/browser` wizard AgentBrowser/CDP path plus `/browser export storageState`, proving saved settings, active status projection, and exported storage-state file contents.
- `mastracode/scripts/mc-e2e/scenarios/browser-wizard-browserbase.ts` — real PTY/TUI e2e coverage for the interactive `/browser` wizard Stagehand Browserbase path: selects Browserbase, verifies credential guidance, skips local launch/profile prompts, clears stale local launch settings, and proves only Browserbase settings persist.
- `mastracode/scripts/mc-e2e/scenarios/browser-profile-provider-mismatch.ts` — real PTY/TUI e2e coverage for profile provider mismatch confirmation: a Stagehand-marked profile reused with AgentBrowser shows the confirmation gate, `No` cancels without persisting, and `Yes` proceeds while rewriting the `.mastra-provider` marker.

## Missing tests

- Interactive `/browser` wizard provider selection, AgentBrowser/CDP saved settings, and storage-state export are covered by `browser-wizard-export`; Browserbase credential guidance and stale local launch-option cleanup are covered by `browser-wizard-browserbase`; quick-command clear-all reset is covered by `browser-settings-persistence`.
- Startup restore for enabled AgentBrowser/CDP settings is covered by `browser-startup-restore`; quick-setting profile/executable persistence and clear-all reset are covered by `browser-settings-persistence`; wizard AgentBrowser/CDP save/export is covered by `browser-wizard-export`, and Browserbase wizard persistence is covered by `browser-wizard-browserbase`. Follow-up breadth remains for Stagehand/Browserbase startup variants and full active-state projection of profile/executable/storage-state fields.
- Profile provider mismatch warnings/cancel/proceed are covered by `browser-profile-provider-mismatch`; remaining e2e status/config-drift breadth is active-vs-pending settings. Baseline `/browser status` disabled/enabled transcript is covered by `integration-commands`.
- Mastra Code TUI/browser integration proving browser reload/history parity and optional live external-provider smoke beyond deterministic CDP attach/tool injection.

## Known risks / regressions

- Browser command behavior is broad but has little direct MastraCode TUI test coverage; most current proof is core Agent/browser tests plus command dispatch routing.
- `activeBrowserSettings` in Mastra Code state schema is narrower than full `BrowserSettings`; profile, executable path, storage-state, and agent-browser subsettings are persisted globally but not fully projected into Harness state.
- Profile reuse can break if Chrome lock cleanup, process-group kill behavior, executable-path launch options, or provider mismatch metadata drifts.
- Provider behavior differs significantly between Stagehand local, Stagehand Browserbase, and Agent Browser.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
