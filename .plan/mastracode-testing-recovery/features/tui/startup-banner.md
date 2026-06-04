# Startup banner

## Origin PR / commit

- PR: [#13422](https://github.com/mastra-ai/mastra/pull/13422) — added responsive ASCII-art header for the TUI startup screen.
- Later changes: none known.

## User-visible behavior

- What the user can do: start `mastracode` and see a branded header above project/resource/user frontmatter.
- Success looks like: wide terminals show `MASTRA CODE` block art; medium terminals show compact `MASTRA`; narrow terminals or custom app names fall back to a single-line text header.
- Must preserve: startup layout stays usable across terminal widths and custom `appName` consumers.

## Entry points / commands

- Commands / shortcuts / flags: `mastracode`; embedded/custom consumers can pass `appName` / `version` through `MastraTUIOptions`.
- Automatic triggers: `buildLayout()` renders the banner before chat/editor containers.

## TUI states

- Idle: banner is static header text above project metadata.
- Active / modal / error: no special active state; banner remains part of layout.

## Headless / non-TUI behavior

- Supported: none — headless output should not render the banner.
- Not supported / unknown: no CLI flag found to disable the banner independently of TUI/custom app rendering.

## Streaming / loading / interrupted states

- Streaming / loading: not streaming; computed once from terminal width, app name, and version.
- Abort / retry / resume: no runtime state to restore.

## Streaming vs loaded-from-history behavior

- While actively streaming: banner is unrelated to message streaming.
- After reload / history reconstruction: banner is re-rendered from current process options, not stored in chat history.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Banner text/style | `renderBanner(version, appName)` | `buildLayout()` |
| Terminal width decision | `process.stdout.columns` | `renderBanner()` |
| App/version display | `TUIState.options` | TUI startup header |

## Key files

- `mastracode/src/tui/components/banner.ts` — responsive banner renderer and gradient coloring.
- `mastracode/src/tui/setup.ts` — inserts banner into the TUI layout before project frontmatter.
- `mastracode/src/tui/state.ts` — carries `MastraTUIOptions.appName` and `version`.

## Dependencies / related features

- [Interactive TUI chat](./interactive-chat.md) — banner is part of the TUI layout around chat.
- [Installation and launch](../setup/installation-and-launch.md) — startup path that users see before chatting.

## Existing tests

- `mastracode/src/tui/components/__tests__/banner.test.ts` — wide, medium, narrow, version, and custom app-name rendering.

## Missing tests

- Full `buildLayout()` snapshot including banner + frontmatter + instructions.
- Theme/contrast regression test for ANSI gradient colors.
- User-facing test that headless mode does not emit banner text.

## Known risks / regressions

- PR title/body said purple gradient, but current code uses Mastra green gradient stops; comments still contain one stale “purple gradient” phrase.
- Banner width uses `process.stdout.columns`; non-standard terminals may get the wrong art size.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
