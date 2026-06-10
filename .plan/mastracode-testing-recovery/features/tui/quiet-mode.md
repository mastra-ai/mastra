# Quiet mode

## Origin PR / commit

- PR: [#13556](https://github.com/mastra-ai/mastra/pull/13556) — added persisted Quiet mode settings for compact TUI output and subagent completion behavior.
- Later changes: [#13870](https://github.com/mastra-ai/mastra/pull/13870) — quiet compact web-search previews use the dedicated web-search formatter; [#16771](https://github.com/mastra-ai/mastra/pull/16771) — adds the current compact quiet-mode renderer, rollout prompt, task summary, tool grouping/preview caps, and settings plumbing; [#16807](https://github.com/mastra-ai/mastra/pull/16807) — polishes quiet follow-ups with smarter compact labels, path-prefix trimming, preview rails, grouped spacing, and loaded-history parity; [#16839](https://github.com/mastra-ai/mastra/pull/16839) — improves quiet task/list contrast and glyph alignment on varied terminal backgrounds; [#16849](https://github.com/mastra-ai/mastra/pull/16849) — fits compact terminal output by visible width, preserving ANSI color and OSC 8 hyperlink sequences while truncating.

## User-visible behavior

- What the user can do: enable Quiet mode from the first-run rollout prompt or `/settings`, choose 0/1/2/4/8 tool preview lines, and render tools/tasks more compactly.
- Success looks like: live tools, loaded history, completed tasks, OM markers, and subagent boxes compact consistently; same-label compact tools group together, continuation labels hide repeated path prefixes, mode color is preserved, and previews do not duplicate summaries.
- Must preserve: classic mode compatibility for existing users, persisted settings across restart, readable subdued glyphs on dark/light terminal backgrounds, visible errors/final results, and rollout state so users are not prompted repeatedly.

## Entry points / commands

- Commands / shortcuts / flags: `/settings` → `Quiet mode` and conditional `Quiet mode tool preview lines`; Ctrl+E still expands compact tool output when needed.
- Automatic triggers: startup loads `settings.preferences.quietMode` and `quietModeMaxToolPreviewLines`; the one-time quiet-mode preference prompt asks existing unselected users whether to enable it and, if accepted, which preview cap to use.

## TUI states

- Idle: `/settings` toggles Quiet mode and preview line limit; the rollout prompt is a modal flow before normal chat input.
- Active / modal / error: live tool components use compact quiet rendering; task transitions render item-aware one-line summaries; shell tools use quiet-shell spacing while other tools use compact grouping.

## Headless / non-TUI behavior

- Supported: persisted settings can be read outside the TUI.
- Not supported / unknown: headless output is not expected to use TUI compact components.

## Streaming / loading / interrupted states

- Streaming / loading: `handleToolStart()` applies compact display and preview-line cap when quiet mode is enabled; streaming previews wait for complete segments, hide duplicate preview lines, and preserve connector rails across grouped follow-up tools.
- Abort / retry / resume: abort/error cleanup still updates pending tool components; quiet mode keeps failed tool state visible and does not block Ctrl+E expansion.

## Streaming vs loaded-from-history behavior

- While actively streaming: `TUIState.quietMode` drives tool and subagent components.
- After reload / history reconstruction: `renderExistingMessages()` applies quiet mode to replayed tool history and task transitions.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Quiet mode enabled | `settings.preferences.quietMode`, copied into `TUIState` at startup | `/settings`, rollout prompt, live tool/subagent/task renderers, history renderer |
| Preview line cap | `settings.preferences.quietModeMaxToolPreviewLines` normalized to 0–8 | Tool compact preview rendering, including web-search/result/code preview rows fit with `truncateAnsi()` visible-width limits |
| Rollout prompt state | `settings.onboarding.quietModePreferenceSelected` | Settings/onboarding migration logic and one-time modal prompt |
| Compact tool mode color | active mode color via `harness.getCurrentMode()` | `ToolExecutionComponentEnhanced` quiet badge and grouped compact labels |
| Compact grouping state | `ToolExecutionComponentEnhanced` group key/summary/continuation flags + chat boundary reconciliation | spacing between same-label quiet tools, repeated-prefix trimming, connector rendering, and preview closure |
| Quiet glyph contrast | `theme.ts` contrast helpers and terminal background detection | task glyphs, tool rails, muted dividers, and compact labels in quiet mode |

## Key files

- `mastracode/src/onboarding/settings.ts` — persisted quiet-mode fields, new-install defaults, rollout parsing, preview cap normalization.
- `mastracode/src/tui/components/settings.ts` — `/settings` rows for Quiet mode and preview line limit.
- `mastracode/src/tui/mastra-tui.ts` — startup settings load into `TUIState`, one-time quiet-mode prompt, and runtime application to existing tools/tasks.
- `mastracode/src/tui/state.ts` — transient quiet-mode projection defaults.
- `mastracode/src/tui/handlers/tool.ts` — live compact tool rendering.
- `mastracode/src/tui/render-messages.ts` — loaded-history compact tool/task/subagent rendering.
- `mastracode/src/tui/components/tool-execution-enhanced.ts` and `tui/ansi.ts` — compact quiet tool UI, visible-width/ANSI-safe preview fitting, preview slicing, grouping keys, continuation labels, path-prefix trimming, and quiet spacing kind.
- `mastracode/src/tui/components/task-progress.ts` — item-aware one-line quiet task summaries.
- `mastracode/src/tui/chat-boundary-reconciliation.ts` and `chat-spacing.ts` — quiet compact grouping/spacing.
- `mastracode/src/tui/theme.ts` — contrast-adapted glyph/rail colors for quiet compact output.
- `mastracode/src/tui/components/subagent-execution.ts` — subagent completion expansion/collapse behavior.

## Dependencies / related features

- [Interactive TUI chat](./interactive-chat.md) — quiet mode changes message/tool layout inside chat.
- [Subagent delegation](../subagents/delegation.md) — completed subagent output is quiet-mode-sensitive.
- [Task tracking](../tools/task-tracking.md) — completed tasks can compact in quiet mode.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — quiet rendering wraps the same runtime tool events.
- [Web search tool rendering](../tools/web-search-rendering.md) — provides compact title/URL previews for web-search calls.
- [Onboarding and global settings](../settings/onboarding-and-global-settings.md) — persistence and rollout live in global settings.

## Existing tests

- `mastracode/src/onboarding/__tests__/settings.test.ts` — quiet-mode defaults, rollout prompt state, and preview line cap normalization.
- `mastracode/src/tui/__tests__/mastra-tui-quiet-mode.test.ts` — one-time quiet-mode preference prompt, accept/decline paths, preview cap selection, and applying settings to live components.
- `mastracode/src/tui/components/__tests__/task-progress.test.ts` — item-aware quiet task summary order, wrapping, wide characters, and expanded/quiet transitions.
- `mastracode/src/tui/components/__tests__/subagent-execution.test.ts` — subagent collapse/expand options and final-result rendering.
- `mastracode/src/tui/components/__tests__/tool-execution-enhanced.test.ts` — quiet compact tool summaries, previews, colors, grouping/continuation behavior, code/list previews, path-prefix trimming, and web-search preview rendering.
- `mastracode/src/tui/handlers/__tests__/message.test.ts` and `chat-spacing` / `chat-boundary-spacer` coverage — spacing around quiet tool previews and grouped compact tools, plus quiet pending-tool error cleanup when an assistant run fails.
- `mastracode/src/tui/__tests__/render-messages.test.ts` — loaded-history rendering, including quiet-mode-sensitive paths.
- `mastracode/scripts/mc-e2e/scenarios/quiet-settings.ts` — partial e2e coverage: toggles Quiet mode through `/settings`, verifies the conditional preview-line row, updates preview lines, and closes/reopens `/settings` to prove both values persist in the real TUI.

## Missing tests

- End-to-end live quiet tool + loaded-history parity with AIMock-backed tool/subagent output.
- Manual TUI smoke covering quiet-mode grouped tools, Ctrl+E expansion, and task summaries in a real terminal width.

## Known risks / regressions

- Quiet mode has multiple projections (settings, TUI state, live tools, loaded history, tasks, subagents), so classic/quiet parity can drift.
- New-install defaults and existing-user rollout state are handled separately; migration bugs can silently flip user preferences.
- Compact grouping depends on terminal visible-width calculations and boundary reconciliation, so later layout changes can reintroduce spacing glitches.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
