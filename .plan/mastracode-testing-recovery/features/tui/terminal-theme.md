# Terminal theme and contrast

## Origin PR / commit

- PR: [#13487](https://github.com/mastra-ai/mastra/pull/13487) — inherit terminal light/dark theme, add `/theme`, and adapt TUI colors for contrast.
- Later changes: [#13503](https://github.com/mastra-ai/mastra/pull/13503) — fixed a startup crash by removing direct `fg`/`bg`/`bold`/`italic`/`dim`/`getTheme`/`setTheme` exports and making the `theme` object the single access point for those helpers; [#14337](https://github.com/mastra-ai/mastra/pull/14337) — expanded adaptive colors, contrast thresholds, light-theme palette, OSC foreground handling, and refined TUI component styling; [#14359](https://github.com/mastra-ai/mastra/pull/14359) — replaced the animated editor border gradient with a solid mode-color border to avoid terminal rendering corruption; [#16839](https://github.com/mastra-ai/mastra/pull/16839) — adds near-black-aware glyph contrast helpers for quiet-mode rails, task glyphs, and muted terminal output.

## User-visible behavior

- What the user can do: use `/theme`, `/theme auto`, `/theme dark`, or `/theme light`; startup auto-detects terminal background unless a persisted or env override is set.
- Success looks like: text, borders, badges, code output, OM/status widgets, overlays, user messages, and the editor box stay readable on dark, light, and mid-grey terminals.
- Must preserve: explicit `MASTRA_THEME` override wins, persisted settings win over auto-detection, terminal foreground is restored on exit, and the editor border remains a solid mode color rather than a high-churn animated gradient.

## Entry points / commands

- Commands / shortcuts / flags: `/theme [auto|dark|light]`; `MASTRA_THEME=dark|light`.
- Automatic triggers: TUI startup loads `settings.preferences.theme`; `auto` queries terminal background via OSC 11, falls back to `COLORFGBG`, then dark.

## TUI states

- Idle: `/theme` shows current mode and persisted preference; changing theme applies immediately and requests render.
- Active / modal / error: components read theme helpers through the exported `theme` object, mode badges/model IDs pulse from the shared gradient animator, and the editor border uses one cached `chalk.hex(modeColor)` function instead of per-character RGB output.

## Headless / non-TUI behavior

- Supported: headless mode does not need terminal theme rendering.
- Not supported / unknown: direct helper exports like `fg()`/`bg()` are intentionally unavailable; external consumers should import `theme` from `mastracode/tui`.

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
| Adapted palette | `theme.ts` computes adapted brand/surface/theme colors against the detected background | TUI components, markdown/editor/select themes, tool output, user/assistant messages |
| Glyph contrast floor | `ensureContrastUnlessNearBlack()` and `ensureTerminalGlyphContrast()` | subdued quiet-mode rails/dividers/tasks on near-black terminals; full contrast adaptation on brighter backgrounds |
| Active theme mode | module state in `theme.ts` | TUI components, status line, markdown/editor/select themes |
| Theme helper API | `theme` object in `theme.ts` | TUI components and public `mastracode/tui` export |
| Prompt/status animation | `GradientAnimator` in `TUIState` | status-line badges/model labels and editor prompt glyph only; editor border stays solid |
| Terminal foreground override | OSC 10 written by `applyThemeMode()` | Terminal default text color until `restoreTerminalForeground()` |

## Key files

- `mastracode/src/main.ts` — startup theme preference/env/auto resolution and cleanup hook.
- `mastracode/src/tui/detect-theme.ts` — OSC 11 terminal background query, `COLORFGBG` fallback, and stdin cleanup.
- `mastracode/src/tui/theme.ts` — dark/light palettes, contrast adaptation, OSC 10 foreground, theme object helpers, and pi-tui theme adapters.
- `mastracode/src/tui/components/custom-editor.ts` — solid mode-color editor border, cached color function, and animated prompt glyph.
- `mastracode/src/tui/status-line.ts` — adapted mode/model badges, queued/goal labels, OM status labels, and responsive footer truncation.
- `mastracode/src/tui/components/tool-execution-enhanced.ts`, `user-message.ts`, and `assistant-message.ts` — theme-aware tool/chat component styling.
- `mastracode/src/tui/index.ts` — public TUI exports; exposes `theme` but not direct `fg`/`bg` helper exports.
- `mastracode/src/tui/commands/theme.ts` — `/theme` command persistence and live apply path.
- `mastracode/src/tui/__tests__/theme-contrast.test.ts` — contrast utility and palette coverage.

## Dependencies / related features

- [Interactive TUI chat](./interactive-chat.md) — live chat components consume the global theme.
- [Help and shortcuts](./help-and-shortcuts.md) — `/theme` appears in the help command list.
- [Onboarding and global settings](../settings/onboarding-and-global-settings.md) — theme preference lives in global settings.
- [Startup banner](./startup-banner.md) — banner colors are theme-adapted through shared color helpers.

## Existing tests

- `mastracode/src/tui/__tests__/theme-contrast.test.ts` — luminance/contrast helpers, brand/surface contrast for dark/light/mid-grey backgrounds, subdued glyph adaptation, terminal glyph minimum contrast.
- `mastracode/src/tui/__tests__/status-line.test.ts` — responsive footer/status rendering around queued counts, PR badges, model path compaction, and mode-color badge formatting.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` — theme handler is mocked in dispatch coverage, but does not prove `/theme` behavior.

## Missing tests

- `/theme` command persistence and immediate render behavior.
- Startup precedence: `MASTRA_THEME` > persisted `preferences.theme` > OSC 11 > `COLORFGBG` > dark.
- OSC 11 stdin cleanup regression, especially not pausing stdin that was already resumed.
- Snapshot or render regression proving the editor border remains solid/cached and does not reintroduce per-character gradient ANSI churn.
- Package-export smoke test proving public `mastracode/tui` exports include the `theme` object and do not reintroduce direct helper exports that can drift from component usage.

## Known risks / regressions

- Terminal detection mutates stdin raw/resume state and writes OSC sequences; regressions can break keyboard input or leave foreground color changed.
- Theme state is module-global, so tests and embedded consumers need reset discipline.
- Direct helper imports caused a startup crash after #13487; keep component usage on `theme.fg()`/`theme.bg()` rather than bare helpers.
- Contrast adaptation preserves hue when possible but may still produce surprising brand colors on unusual terminal backgrounds.
- Reintroducing animated borders or long per-character RGB gradients can corrupt output in some terminal emulators; keep long-lived borders solid and reserve gradient animation for short status/prompt strings.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
