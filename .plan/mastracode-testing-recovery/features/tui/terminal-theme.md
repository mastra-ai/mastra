# Terminal theme and contrast

## Origin PR / commit

- PR: [#13487](https://github.com/mastra-ai/mastra/pull/13487) — inherit terminal light/dark theme, add `/theme`, and adapt TUI colors for contrast.
- Later changes: [#13503](https://github.com/mastra-ai/mastra/pull/13503) is queued next-ish and appears to adjust theme exports after a startup crash; verify before relying on public export details.

## User-visible behavior

- What the user can do: use `/theme`, `/theme auto`, `/theme dark`, or `/theme light`; startup auto-detects terminal background unless a persisted or env override is set.
- Success looks like: text, borders, badges, code output, OM/status widgets, and overlays stay readable on dark, light, and mid-grey terminals.
- Must preserve: explicit `MASTRA_THEME` override wins, persisted settings win over auto-detection, and terminal foreground is restored on exit.

## Entry points / commands

- Commands / shortcuts / flags: `/theme [auto|dark|light]`; `MASTRA_THEME=dark|light`.
- Automatic triggers: TUI startup loads `settings.preferences.theme`; `auto` queries terminal background via OSC 11, falls back to `COLORFGBG`, then dark.

## TUI states

- Idle: `/theme` shows current mode and persisted preference; changing theme applies immediately and requests render.
- Active / modal / error: global theme functions are read at render time, so components should pick up the current theme on next render.

## Headless / non-TUI behavior

- Supported: headless mode does not need terminal theme rendering.
- Not supported / unknown: whether exported `mastracode/tui` theme helpers are safe for external consumers across package builds until queued #13503 is verified.

## Streaming / loading / interrupted states

- Streaming / loading: theme changes affect subsequent renders of live components; no model-stream state is persisted.
- Abort / retry / resume: exit handlers call `restoreTerminalForeground()` to undo OSC 10 foreground changes.

## Streaming vs loaded-from-history behavior

- While actively streaming: colors are applied by current TUI render functions and theme proxy values.
- After reload / history reconstruction: message content is persisted, styling is recomputed from the current theme when rendered.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Theme preference | `settings.json` `preferences.theme`, unless `MASTRA_THEME` is set | Startup theme resolution, `/theme` |
| Detected terminal background | Runtime OSC 11 / `COLORFGBG` detection | `applyThemeMode()`, contrast adaptation |
| Active theme mode | module state in `theme.ts` | TUI components, status line, markdown/editor/select themes |
| Terminal foreground override | OSC 10 written by `applyThemeMode()` | Terminal default text color until `restoreTerminalForeground()` |

## Key files

- `mastracode/src/main.ts` — startup theme preference/env/auto resolution and cleanup hook.
- `mastracode/src/tui/detect-theme.ts` — OSC 11 terminal background query, `COLORFGBG` fallback, and stdin cleanup.
- `mastracode/src/tui/theme.ts` — dark/light palettes, contrast adaptation, OSC 10 foreground, and pi-tui theme adapters.
- `mastracode/src/tui/commands/theme.ts` — `/theme` command persistence and live apply path.
- `mastracode/src/tui/__tests__/theme-contrast.test.ts` — contrast utility and palette coverage.

## Dependencies / related features

- [Interactive TUI chat](./interactive-chat.md) — live chat components consume the global theme.
- [Help and shortcuts](./help-and-shortcuts.md) — `/theme` appears in the help command list.
- [Onboarding and global settings](../settings/onboarding-and-global-settings.md) — theme preference lives in global settings.
- [Startup banner](./startup-banner.md) — banner colors are theme-adapted through shared color helpers.

## Existing tests

- `mastracode/src/tui/__tests__/theme-contrast.test.ts` — luminance/contrast helpers, brand contrast for dark/light/mid-grey backgrounds, subdued glyph adaptation.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` — theme handler is mocked in dispatch coverage, but does not prove `/theme` behavior.

## Missing tests

- `/theme` command persistence and immediate render behavior.
- Startup precedence: `MASTRA_THEME` > persisted `preferences.theme` > OSC 11 > `COLORFGBG` > dark.
- OSC 11 stdin cleanup regression, especially not pausing stdin that was already resumed.
- Package-export smoke test for public `mastracode/tui` theme exports after #13503.

## Known risks / regressions

- Terminal detection mutates stdin raw/resume state and writes OSC sequences; regressions can break keyboard input or leave foreground color changed.
- Theme state is module-global, so tests and embedded consumers need reset discipline.
- Contrast adaptation preserves hue when possible but may still produce surprising brand colors on unusual terminal backgrounds.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
