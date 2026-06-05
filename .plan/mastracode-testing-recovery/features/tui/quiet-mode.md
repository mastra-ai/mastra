# Quiet mode

## Origin PR / commit

- PR: [#13556](https://github.com/mastra-ai/mastra/pull/13556) — added persisted Quiet mode settings for compact TUI output and subagent completion behavior.
- Later changes: [#13870](https://github.com/mastra-ai/mastra/pull/13870) — quiet compact web-search previews use the dedicated web-search formatter.
- Later queued changes: [#16771](https://github.com/mastra-ai/mastra/pull/16771), [#16807](https://github.com/mastra-ai/mastra/pull/16807), and [#16839](https://github.com/mastra-ai/mastra/pull/16839) also touch quiet mode and still need mapping when the queue reaches them.

## User-visible behavior

- What the user can do: enable Quiet mode from `/settings` to render tools compactly, tune preview line count, and reduce completed task/subagent noise.
- Success looks like: live tools, loaded history, completed tasks, OM markers, and subagent boxes compact consistently without hiding final useful output.
- Must preserve: classic mode compatibility for existing users and persisted settings across restart.

## Entry points / commands

- Commands / shortcuts / flags: `/settings` → `Quiet mode` and `Quiet mode tool preview lines`.
- Automatic triggers: startup loads `settings.preferences.quietMode` and `quietModeMaxToolPreviewLines`; new installs currently default to Quiet mode on.

## TUI states

- Idle: `/settings` toggles Quiet mode and preview line limit.
- Active / modal / error: live tool components use compact quiet rendering; task transitions and subagent output read the same state.

## Headless / non-TUI behavior

- Supported: persisted settings can be read outside the TUI.
- Not supported / unknown: headless output is not expected to use TUI compact components.

## Streaming / loading / interrupted states

- Streaming / loading: `handleToolStart()` applies compact display and preview-line cap when quiet mode is enabled.
- Abort / retry / resume: abort/error cleanup still updates pending tool components; quiet mode should not suppress error visibility.

## Streaming vs loaded-from-history behavior

- While actively streaming: `TUIState.quietMode` drives tool and subagent components.
- After reload / history reconstruction: `renderExistingMessages()` applies quiet mode to replayed tool history and task transitions.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Quiet mode enabled | `settings.preferences.quietMode`, copied into `TUIState` at startup | `/settings`, live tool/subagent/task renderers, history renderer |
| Preview line cap | `settings.preferences.quietModeMaxToolPreviewLines` | Tool compact preview rendering, including web-search result preview rows |
| Rollout prompt state | `settings.onboarding.quietModePreferenceSelected` | Settings/onboarding migration logic |
| Compact tool mode color | active mode color via `harness.getCurrentMode()` | `ToolExecutionComponentEnhanced` quiet badge |

## Key files

- `mastracode/src/onboarding/settings.ts` — persisted quiet-mode fields, new-install defaults, rollout parsing, preview cap normalization.
- `mastracode/src/tui/components/settings.ts` — `/settings` rows for Quiet mode and preview line limit.
- `mastracode/src/tui/mastra-tui.ts` — startup settings load into `TUIState`.
- `mastracode/src/tui/state.ts` — transient quiet-mode projection defaults.
- `mastracode/src/tui/handlers/tool.ts` — live compact tool rendering.
- `mastracode/src/tui/render-messages.ts` — loaded-history compact tool/task/subagent rendering.
- `mastracode/src/tui/components/tool-execution-enhanced.ts` — compact quiet tool UI.
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
- `mastracode/src/tui/components/__tests__/subagent-execution.test.ts` — subagent collapse/expand options and final-result rendering.
- `mastracode/src/tui/components/__tests__/tool-execution-enhanced.test.ts` — quiet compact tool summaries, previews, colors, and web-search preview rendering.
- `mastracode/src/tui/handlers/__tests__/message.test.ts` — spacing around quiet tool previews.
- `mastracode/src/tui/__tests__/render-messages.test.ts` — loaded-history rendering, including quiet-mode-sensitive paths.

## Missing tests

- End-to-end `/settings` toggle → restart → live tool + loaded-history parity.
- Direct test that the current source behavior for subagents is intentional: `quietMode` now passes `expandOnComplete`, while the setting copy still says completed subagents collapse.
- Error/abort path proving quiet compact tools still surface failed pending tool results.

## Known risks / regressions

- The setting description says Quiet mode collapses completed subagents, but current source passes `expandOnComplete: state.quietMode`; later quiet-mode PRs may have changed the intended behavior.
- Quiet mode has multiple projections (settings, TUI state, live tools, loaded history, tasks, subagents), so classic/quiet parity can drift.
- New-install defaults and existing-user rollout state are handled separately; migration bugs can silently flip user preferences.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
