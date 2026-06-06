# Process suspend shortcut

## Origin PR / commit

- PR: [#13723](https://github.com/mastra-ai/mastra/pull/13723) — changes Ctrl+Z from undo-last-clear to Unix process suspend (`SIGTSTP`) and moves undo-last-clear to Alt+Z.

## User-visible behavior

- What the user can do: press Ctrl+Z in the TUI to suspend the Mastra Code process, then resume it from the shell with `fg`.
- Success looks like: the TUI exits raw/managed mode before suspend, the shell regains control, and the TUI restarts rendering after `SIGCONT`.
- Must preserve: Ctrl+Z must not mutate chat/editor state; Alt+Z remains the undo-last-clear shortcut; Windows should not attempt Unix signal suspension.

## Entry points / commands

- Commands / shortcuts / flags: Ctrl+Z (`suspend` editor action), Alt+Z (`undo` editor action).
- Automatic triggers: `SIGCONT` listener restarts the TUI after shell resume.

## TUI states

- Idle: Ctrl+Z stops the UI and sends `SIGTSTP`; Alt+Z restores `lastClearedText` only when editor text is empty.
- Active / modal / error: suspend action is registered at editor level; current verification did not prove modal-specific behavior.

## Headless / non-TUI behavior

- Supported: no headless shortcut path; this is TUI-only keyboard behavior.
- Not supported / unknown: Windows process suspension. Current TUI shows `Suspend is not supported on Windows` instead of sending `SIGTSTP`.

## Streaming / loading / interrupted states

- Streaming / loading: suspension pauses the whole process rather than aborting the run; the UI restarts on `SIGCONT` and requests render.
- Abort / retry / resume: if `process.kill(process.pid, 'SIGTSTP')` throws, setup removes the `SIGCONT` listener, restarts the UI, requests render, and shows an error.

## Streaming vs loaded-from-history behavior

- While actively streaming: no history mutation; behavior is process-level.
- After reload / history reconstruction: no persisted state change from suspension.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Suspend action | `CustomEditor` key routing + `setupKeyboardShortcuts()` handler | TUI process/UI lifecycle |
| Resume handling | `process.once('SIGCONT')` callback | `state.ui.start()`, `requestRender()` |
| Undo-last-clear buffer | `TUIState.lastClearedText` | Alt+Z undo handler |
| Help text | `help-overlay.ts` shortcuts table | `/help` overlay |

## Key files

- `mastracode/src/tui/components/custom-editor.ts` — maps Ctrl+Z to `suspend` and Alt+Z to `undo`.
- `mastracode/src/tui/setup.ts` — handles suspend/resume/error behavior and Alt+Z undo restore.
- `mastracode/src/tui/state.ts` — stores `lastClearedText` for Alt+Z undo.
- `mastracode/src/tui/components/help-overlay.ts` — shortcut descriptions for Ctrl+Z and Alt+Z.
- `mastracode/src/tui/components/settings.ts` — updated shortcut/setting copy around Esc/Ctrl+C behavior in the same PR.

## Dependencies / related features

- [Interactive TUI chat](./interactive-chat.md) — owns editor input and UI lifecycle.
- [Help and shortcuts](./help-and-shortcuts.md) — lists Ctrl+Z and Alt+Z shortcut behavior.

## Existing tests

- `mastracode/src/tui/components/__tests__/help-overlay.test.ts` — asserts shortcut entries include Ctrl+Z.
- `mastracode/src/tui/components/__tests__/custom-editor.test.ts` — covers Ctrl+Z routing to `suspend`, Alt+Z routing to `undo`, and prevents shortcut fallthrough to the base editor.
- `mastracode/src/tui/__tests__/setup-keyboard-shortcuts.test.ts` — covers suspend lifecycle (`ui.stop()`, `SIGCONT` listener, `SIGTSTP`, resume render), Windows guard, `process.kill()` failure recovery, and Alt+Z undo-last-clear behavior.

## Missing tests

- Integration test proving active streamed output resumes cleanly after shell `fg`.

## Known risks / regressions

- Signal behavior differs by platform/terminal; Windows is intentionally guarded.
- If TUI raw-mode cleanup or resume handling drifts, the terminal can remain in a bad state after suspend/resume.
- Shortcut drift risk: help text, settings copy, and editor key routing must remain aligned.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
