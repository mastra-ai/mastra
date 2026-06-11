# Configuration modal overlays

## Origin PR / commit

- PR: [#16274](https://github.com/mastra-ai/mastra/pull/16274) — standardizes setup and configuration flows as modal overlays.
- Later changes: none known.

## User-visible behavior

- What the user can do: run setup/configuration commands (`/setup`, `/models`, `/sandbox`, `/api-keys`, `/subagents`, `/browser`, `/memory-gateway`, `/observability`, `/custom-providers`, `/think`, update prompts, and thread/goal dialogs) without those controls appearing as inline chat messages.
- Success looks like: modal content opens centered with bounded width/height, sparse dialogs get vertical padding, Escape cancels, selection/input focus stays inside the overlay, and nested model-picker/API-key flows hide overlays before resolving.
- Must preserve: no lost answers, no overlay left stuck after submit/cancel, no model-pack submenu Escape regressions, and neutral tool backgrounds instead of green-tinted pending/success surfaces.

## Entry points / commands

- Commands / shortcuts / flags: setup/config slash commands plus startup onboarding/update/quiet prompts.
- Automatic triggers: first-run onboarding, update checks, quiet-mode preference prompt, login/API-key prompts launched by model selection.

## TUI states

- Idle: command opens a modal through `showModalOverlay()` or shared `askModalQuestion()`.
- Active / modal / error: `TUI.showOverlay()` owns the focus layer; callers call `hideOverlay()` before resolving callbacks or launching the next nested overlay.

## Headless / non-TUI behavior

- Supported: command helpers still support direct arguments where they existed before.
- Not supported / unknown: modal overlays require a `TUI`; headless flows use separate command/headless paths.

## Streaming / loading / interrupted states

- Streaming / loading: overlays are idle/config UI, not stream-rendered assistant content.
- Abort / retry / resume: Escape/cancel resolves `null`/skips the command-specific action; no overlay state is restored from persisted history.

## Streaming vs loaded-from-history behavior

- While actively streaming: configuration overlays should not be opened as agent output; active-run prompts still use their dedicated prompt components.
- After reload / history reconstruction: only settings/thread metadata persist, not open overlays.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Overlay sizing/min-height | `modalOverlayOptions()` and `MinHeightOverlay` in `tui/overlay.ts` | All config modal helpers |
| Modal question result | `askModalQuestion()` wrapping `AskQuestionDialogComponent` | Browser/custom-provider/memory-gateway/observability/subagent/thread prompt flows |
| Command-specific settings | Existing settings/thread/auth storage owners | `/setup`, `/models`, `/api-keys`, `/browser`, `/memory-gateway`, `/observability`, `/custom-providers`, `/subagents`, `/think` |
| Tool pending/success background | `theme.ts` maps both to neutral surface colors | Tool renderers and overlay contrast |

## Key files

- `mastracode/src/tui/overlay.ts` — shared modal sizing, max-width, min-height padding, and top-padding cap.
- `mastracode/src/tui/modal-question.ts` — shared question helper that opens `AskQuestionDialogComponent` in a modal and resolves on submit/cancel.
- `mastracode/src/tui/mastra-tui.ts` and `mastracode/src/onboarding/onboarding-inline.ts` — startup and `/setup` onboarding overlays plus nested model-selector overlays.
- `mastracode/src/tui/commands/models-pack.ts`, `sandbox.ts`, `api-keys.ts`, `subagents.ts`, `browser.ts`, `memory-gateway.ts`, `observability.ts`, `custom-providers.ts`, `login.ts`, and `mcp.ts` — config commands now routed through modal overlay helpers.
- `mastracode/src/tui/theme.ts` — neutralizes `toolPendingBg` and `toolSuccessBg`.

## Dependencies / related features

- [Onboarding and global settings](../settings/onboarding-and-global-settings.md) — settings persistence behind the overlay flows.
- [Interactive prompts and access requests](./interactive-prompts.md) — shared ask-question components and input behavior.
- [Model authentication, selection, and modes](../models/model-auth-and-modes.md) — model/auth selectors opened by setup and `/models`.

## Existing tests

- `mastracode/src/tui/__tests__/overlay.test.ts` — modal min-height padding, max-height cap, and top-padding behavior.
- `mastracode/src/tui/__tests__/modal-question.test.ts` — `askModalQuestion()` shows/focuses the modal, forwards overlay options, hides the overlay on submit/cancel, and resolves submitted answers or `null` on cancel.
- Command tests that mock `askModalQuestion()` / `showModalOverlay()` (for example `commands/__tests__/github.test.ts`, `goal.test.ts`, `memory-gateway.test.ts`) — prove modal helpers are invoked for focused command flows.
- `mastracode/src/tui/__tests__/mastra-tui-quiet-mode.test.ts` — quiet-mode rollout prompt uses `askModalQuestion()`.
- `mastracode/scripts/mc-e2e/scenarios/modal-and-shell.ts` — real PTY coverage: opens `/sandbox`, asserts the modal question/action text, cancels with Escape, and proves the overlay returns focus to the normal editor.
- `mastracode/scripts/mc-e2e/scenarios/setup-nested-model-selector.ts` — real PTY coverage: opens `/setup`, chooses the custom model pack, enters a pack name, opens the nested model selector, cancels with Escape, and proves the parent setup overlay resumes while the selector is gone.

## Missing tests

- Snapshot/visual regression for neutral tool pending/success backgrounds across dark/light themes.
- Additional command-specific modal breadth for the less common config commands (`/memory-gateway`, `/observability`, `/subagents`) remains follow-up.

## Known risks / regressions

- Nested flows must hide the current overlay before showing the next one; otherwise focus can be captured by a stale modal.
- Several commands still construct custom `Box` containers manually before calling `showModalOverlay()`, so modal behavior can drift across command implementations.
- Overlay sizing depends on terminal rows/columns and ANSI width; very small terminals remain a risk.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
