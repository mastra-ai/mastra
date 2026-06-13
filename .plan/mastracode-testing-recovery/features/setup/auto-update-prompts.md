# Auto-update prompts

## Origin PR / commit

- PR: [#13603](https://github.com/mastra-ai/mastra/pull/13603) — checks npm for newer `mastracode` versions on session start and prompts the user to update.
- Later changes: [#13760](https://github.com/mastra-ai/mastra/pull/13760) — inlines `MASTRACODE_VERSION` at build time so published npm installs do not require `package.json` at runtime; [#13767](https://github.com/mastra-ai/mastra/pull/13767) — falls back to package metadata when running directly from source without the build define; [#13768](https://github.com/mastra-ai/mastra/pull/13768) — makes that source fallback ESM-compatible via `readFileSync` + `fileURLToPath`; [#13787](https://github.com/mastra-ai/mastra/pull/13787) — adds the manual `/update` slash command that reuses the same registry/changelog/update helpers; [#15924](https://github.com/mastra-ai/mastra/pull/15924) — fetches and displays concise changelog bullets in both startup and manual update prompts; [#16920](https://github.com/mastra-ai/mastra/pull/16920) — converts update notifications from modal prompts to inline chat questions and schedules passive 45-minute recheck banners.

## User-visible behavior

- What the user can do: start the TUI and receive a Y/N inline prompt when a newer package version is available, or run `/update` manually to re-check and install with a concise "What's new" changelog summary.
- Success looks like: startup remains usable when the registry/changelog is unavailable, published npm installs can report their current version without reading `package.json`, source runs can still resolve package metadata without CommonJS `require`, update prompts show full concise changelog entries, `/update` clears dismissed-version state before prompting, and choosing No persists the dismissed version.
- Must preserve: no blocking startup on network failure, no repeated prompt spam for a dismissed version, package-manager-specific install commands, and no fatal runtime `package.json` require in packaged builds.

## Entry points / commands

- Commands / shortcuts / flags: automatic startup check; `/update` manual check/install command.
- Automatic triggers: `MastraTUI.run()` startup calls `checkForUpdate()` after onboarding/startup UI work, then schedules passive rechecks every 45 minutes.

## TUI states

- Idle: if a newer version exists and has not been dismissed, an inline Yes/No question is added to chat; `/update` always checks and prompts when a newer version exists.
- Active / modal / error: passive rechecks use an info banner once per process; failed registry/changelog fetches are non-fatal; failed update execution shows the exact install command to run manually.

## Headless / non-TUI behavior

- Supported: version detection helpers are shared by CLI startup/analytics, but the interactive update prompt is TUI-owned.
- Not supported / unknown: no headless auto-update prompt path was verified.

## Streaming / loading / interrupted states

- Streaming / loading: update prompts should run around startup/idle UI, not during an active assistant stream.
- Abort / retry / resume: choosing No stores `settings.updateDismissedVersion`; choosing Yes runs the package-manager install and exits/requires restart on success.

## Streaming vs loaded-from-history behavior

- While actively streaming: not part of assistant message history.
- After reload / history reconstruction: dismissed version is loaded from global settings, not thread history.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Current version | `getCurrentVersion()` build define (`MASTRACODE_VERSION`) with ESM-safe source-run package metadata fallback | TUI prompt, analytics, `/update` |
| Latest version/changelog | npm registry + unpkg changelog fetchers plus `parseChangelog()` filtering/formatting | Startup update prompt, `/update` |
| Dismissed version | `settings.json` `updateDismissedVersion` | Startup prompt suppression, `/update` clear/skip behavior |
| Package manager | `detectPackageManager()` | Auto-update command selection, manual `/update` |

## Key files

- `mastracode/src/utils/update-check.ts` — package-manager detection, build-time/current-version resolution, latest-version fetch, semver comparison, changelog fetch/parse (`MAX_CHANGELOG_ENTRIES=20`, dependency-entry filtering, markdown/PR ref cleanup), and update execution helpers.
- `mastracode/src/tui/mastra-tui.ts` — startup/passive update checks and inline update prompt with optional changelog text.
- `mastracode/src/onboarding/settings.ts` — `updateDismissedVersion` persistence.
- `mastracode/src/tui/commands/update.ts` — manual `/update` command, inline prompt with optional changelog text, install execution, and dismissed-version persistence.
- `mastracode/src/main.ts` — passes `getCurrentVersion()` into analytics and TUI options.
- `mastracode/tsup.config.ts` — injects `MASTRACODE_VERSION` from package metadata at build time.

## Dependencies / related features

- [Installation and launch](./installation-and-launch.md) — package entry point and startup runtime.
- [Onboarding and global settings](../settings/onboarding-and-global-settings.md) — persisted dismissed-version state.
- [Interactive TUI chat](../tui/interactive-chat.md) — inline prompt rendering.

## Existing tests

- `mastracode/src/utils/__tests__/update-check.test.ts` — package-manager detection from env/path signals, install command generation for npm/pnpm/yarn/bun, ESM-safe source `getCurrentVersion()` fallback, semver comparison, changelog parsing and live changelog fetch behavior, including dependency-entry filtering, markdown/PR reference stripping, full-entry preservation, and known published-version fetches.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` — `/update` command dispatch is mocked/registered.
- `mastracode/src/tui/commands/__tests__/update.test.ts` — direct `/update` coverage for registry failure, already-latest path, changelog prompt text, clearing previous dismissed versions, No dismissed-version persistence, and failed-update manual install guidance.
- Settings tests include `updateDismissedVersion` defaults/loading in the global settings object.
- `mastracode/scripts/mc-e2e/scenarios/update-command-prompt.ts` — partial TUI e2e coverage for manual `/update`: uses hermetic update latest-version/changelog env overrides, renders the inline question/changelog through the real TUI, selects `No`, and asserts `Update skipped.`
- `mastracode/scripts/mc-e2e/scenarios/update-startup-prompt.ts` — partial TUI e2e coverage for automatic startup update prompts: uses the same hermetic latest-version/changelog env overrides, waits for the startup inline prompt, selects `No`, and proves `settings.updateDismissedVersion` persistence.

## Missing tests

- Covered: startup prompt rendering, startup changelog insertion, and `No` dismissal persistence via `update-startup-prompt`; manual `/update` prompt/changelog/No flow via `update-command-prompt`; package-manager detection, install command generation, semver comparison, and source-run current-version fallback via `update-check.test.ts`; failed-update manual guidance via `update.test.ts`.
- Deferred: successful `/update` install that exits/restarts and passive 45-minute recheck banners. Both require mutating process/global-install lifecycle or waiting on timer behavior and are not deterministic row blockers.
- Deferred: packaged-build behavior without `package.json`; source fallback is covered and build-time define injection is covered by package metadata/build tests.

## Known risks / regressions

- Published-package builds can fail at startup if current-version detection falls back to runtime `package.json` access when that file is not shipped; source runs can fail if fallback code assumes CommonJS `require` in an ESM package.
- Network-dependent update checks can slow or annoy startup if timeout/suppression behavior regresses.
- Manual `/update` and automatic startup prompt can drift because they share helpers but have separate UI paths and different message copy.
- Changelog parsing is intentionally simple Markdown slicing/filtering; future Changesets format changes can hide entries or show noisy dependency rows.
- Simple semver comparison can mishandle prerelease/build metadata if future releases depend on it.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
