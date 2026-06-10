# File autocomplete

## Origin PR / commit

- PR: [#13460](https://github.com/mastra-ai/mastra/pull/13460) — wires the detected `fd` / `fdfind` binary into the TUI autocomplete provider so `@` file references work.
- Later changes: none verified in this pass.

## User-visible behavior

- What the user can do: type `@` plus a partial path/name in the editor to fuzzy-search project files and insert a file reference.
- Success looks like: when `fd` or `fdfind` is installed, file suggestions appear; when neither exists, slash autocomplete still works and file suggestions silently stay unavailable.
- Must preserve: autocomplete command ordering, custom command/skill suggestions, and graceful fallback when `fd` detection fails.

## Entry points / commands

- Commands / shortcuts / flags: editor autocomplete for `@...`; Tab/selection behavior is provided by `CombinedAutocompleteProvider`.
- Automatic triggers: `setupAutocomplete()` runs during TUI setup and passes `process.cwd()` plus `fdPath` into the provider.

## TUI states

- Idle: autocomplete provider is attached to the editor after layout/command setup.
- Active / modal / error: autocomplete is editor-local; no modal/error path is shown when `fd` is missing.

## Headless / non-TUI behavior

- Supported: none verified; this is TUI editor behavior.
- Not supported / unknown: headless `--prompt` does not use editor autocomplete.

## Streaming / loading / interrupted states

- Streaming / loading: same autocomplete provider remains attached while prompts can be queued.
- Abort / retry / resume: no persisted autocomplete state; provider is rebuilt on startup or skill refresh.

## Streaming vs loaded-from-history behavior

- While actively streaming: `@` completion affects only newly typed queued/follow-up text.
- After reload / history reconstruction: inserted file references are just message text; suggestions are recomputed from the current workspace.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| `fdPath` | `setup.ts` detection via `which`/`where` | `CombinedAutocompleteProvider` |
| Slash/custom/skill commands | `setupAutocomplete()` from TUI state | Editor autocomplete |
| Project search root | `process.cwd()` at setup time | File autocomplete provider |

## Key files

- `mastracode/src/tui/setup.ts` — detects `fd`/`fdfind`, builds slash commands, and constructs `CombinedAutocompleteProvider(slashCommands, process.cwd(), fdPath)`.
- `mastracode/src/tui/__tests__/setup-keyboard-shortcuts.test.ts` — verifies command autocomplete ordering, but not `fdPath` propagation.
- `mastracode/README.md` — documents optional `fd` install and `@` file-reference usage.

## Dependencies / related features

- [Interactive TUI chat](./interactive-chat.md) — autocomplete lives in the editor used for chat prompts.
- [Help and shortcuts](./help-and-shortcuts.md) — `/help` documents editor affordances separately from slash commands.
- [Skills command and workspace resolution](../integrations/skills-command.md) — skill autocomplete entries are rebuilt by the same provider setup.

## Existing tests

- `mastracode/src/tui/__tests__/setup-keyboard-shortcuts.test.ts` — verifies slash/custom/skill command lists, refresh behavior, `fd` detection, `fdfind` fallback, missing-binary fallback, `process.cwd()` root propagation, and `fdPath` propagation into `CombinedAutocompleteProvider`.
- `mastracode/scripts/mc-e2e/scenarios/file-autocomplete.ts` — real PTY e2e coverage: launches from an isolated git fixture project with a deterministic fake `fd`, types `@auto`, verifies the fixture file suggestion is visible, presses Tab, and verifies the `@src/autocomplete-target.ts` reference is inserted in the editor.

## Missing tests

- None currently identified for the core file autocomplete contract; future coverage can add queued-follow-up autocomplete if regressions appear.

## Known risks / regressions

- Current tests mock `CombinedAutocompleteProvider` with only the commands parameter, so the `fdPath` wire-up can regress without a failing test.
- `process.cwd()` is used as the search root; dynamic workspace/project root drift may affect suggestions in unusual launch contexts.
- Missing `fd` fails silently by design, which is friendly but makes broken installs easy to miss.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
