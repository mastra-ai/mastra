# Auto-update prompts

## Origin PR / commit

- PR: [#13603](https://github.com/mastra-ai/mastra/pull/13603) — checks npm for newer `mastracode` versions on session start and prompts the user to update.
- Later changes: [#13760](https://github.com/mastra-ai/mastra/pull/13760) — inlines `MASTRACODE_VERSION` at build time so published npm installs do not require `package.json` at runtime; current source also has an `/update` command, and queue row #13787 should verify and map that slash-command path separately.

## User-visible behavior

- What the user can do: start the TUI and receive a Y/N inline prompt when a newer package version is available; decline to skip that version until a manual update or a newer version appears.
- Success looks like: startup remains usable when the registry/changelog is unavailable, published npm installs can report their current version without reading `package.json`, update prompts show concise changelog entries, and choosing No persists the dismissed version.
- Must preserve: no blocking startup on network failure, no repeated prompt spam for a dismissed version, package-manager-specific install commands, and no fatal runtime `package.json` require in packaged builds.

## Entry points / commands

- Commands / shortcuts / flags: automatic startup check; current source also exposes `/update`, but that later command is not the origin behavior of #13603.
- Automatic triggers: `MastraTUI.run()` startup calls `checkForUpdate()` after onboarding/startup UI work, then schedules passive rechecks every 45 minutes.

## TUI states

- Idle: if a newer version exists and has not been dismissed, an inline Yes/No question is added to chat.
- Active / modal / error: passive rechecks use an info banner once per process; failed registry/changelog fetches are non-fatal.

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
| Current version | `getCurrentVersion()` build define (`MASTRACODE_VERSION`) with source-run fallback | TUI prompt, analytics, `/update` |
| Latest version/changelog | npm registry + unpkg changelog fetchers | Startup update prompt |
| Dismissed version | `settings.json` `updateDismissedVersion` | Startup prompt suppression |
| Package manager | `detectPackageManager()` | Auto-update command selection |

## Key files

- `mastracode/src/utils/update-check.ts` — package-manager detection, build-time/current-version resolution, latest-version fetch, semver comparison, changelog fetch/parse, and update execution helpers.
- `mastracode/src/tui/mastra-tui.ts` — startup/passive update checks and inline update prompt.
- `mastracode/src/onboarding/settings.ts` — `updateDismissedVersion` persistence.
- `mastracode/src/tui/commands/update.ts` — current manual update command; verify against #13787 later.
- `mastracode/src/main.ts` — passes `getCurrentVersion()` into analytics and TUI options.
- `mastracode/tsup.config.ts` — injects `MASTRACODE_VERSION` from package metadata at build time.

## Dependencies / related features

- [Installation and launch](./installation-and-launch.md) — package entry point and startup runtime.
- [Onboarding and global settings](../settings/onboarding-and-global-settings.md) — persisted dismissed-version state.
- [Interactive TUI chat](../tui/interactive-chat.md) — inline prompt rendering.

## Existing tests

- `mastracode/src/utils/__tests__/update-check.test.ts` — changelog parsing and live changelog fetch behavior.
- `mastracode/src/tui/commands/__tests__/update.test.ts` — current manual `/update` command behavior; map fully when processing #13787.
- Settings tests include `updateDismissedVersion` defaults/loading in the global settings object.

## Missing tests

- TUI startup integration test for the automatic update prompt, dismissed-version suppression, and passive 45-minute recheck banner.
- Package-manager detection tests across npm/pnpm/yarn/bun install contexts.
- `getCurrentVersion()` tests for build-time define, source fallback, and packaged-build behavior without `package.json`.
- Auto-update execution failure/success tests that do not actually mutate the developer's global install.

## Known risks / regressions

- Published-package builds can fail at startup if current-version detection falls back to runtime `package.json` access when that file is not shipped.
- Network-dependent update checks can slow or annoy startup if timeout/suppression behavior regresses.
- Manual `/update` and automatic startup prompt can drift because they share helpers but have separate UI paths.
- Simple semver comparison can mishandle prerelease/build metadata if future releases depend on it.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
