# Editor API

This reference lists the primary exports from `@pierre/diffs/edit` and the
editor APIs used by common integrations.

## Exports

| Export                      | Kind  | Purpose                                                        |
| --------------------------- | ----- | -------------------------------------------------------------- |
| `CaretMetadata`             | Type  | Supplies the color shared by a remote caret and its highlight. |
| `Editor`                    | Class | Adds text editing to a `File` or `FileDiff` instance.          |
| `EditorCaret`               | Type  | Describes an externally owned caret or highlighted selection.  |
| `EditStateManager`          | Value | Manages keyed in-memory edit history and state.                |
| `ClearEditStateOptions`     | Type  | Selects retained state parts to clear.                         |
| `EditState`                 | Type  | Holds one complete live editing session.                       |
| `EditorInitialState`        | Type  | Selects state fields to supply on first attachment.            |
| `EditorChange`              | Type  | Describes one normalized editor change.                        |
| `EditorChangeEvent`         | Type  | Provides normalized edits and the current document.            |
| `EditorActiveLineOptions`   | Type  | Configures reveal behavior for an editor active line.          |
| `EditorEditCompleteEvent`   | Type  | Unites file and diff completion events for editor observation. |
| `FileEditCompleteEvent`     | Type  | Describes a completed file edit session.                       |
| `FileDiffEditCompleteEvent` | Type  | Describes a completed diff edit session.                       |
| `EditorCommand`             | Type  | Names an editor command.                                       |
| `EditorType`                | Type  | Selects a `file` or `file-diff` editor surface.                |
| `EditorFactory`             | Type  | Defines an editor-type-aware editor factory.                   |
| `EditorFocusOptions`        | Type  | Selects a focus target and scroll behavior.                    |
| `EditorKeymap`              | Type  | Defines ordered custom shortcut groups.                        |
| `EditorOptions`             | Type  | Configures history, initial state, behavior, and events.       |
| `EditorShortcut`            | Type  | Defines one command shortcut.                                  |
| `EditorSelection`           | Type  | Adds caret direction to an editor range.                       |
| `EditorViewState`           | Type  | Holds selections and editor-owned viewport offsets.            |
| `EditorViewportState`       | Type  | Holds horizontal and optional vertical scroll offsets.         |
| `KeyboardKey`               | Type  | Names a key accepted by an editor shortcut.                    |
| `KeyboardModifier`          | Type  | Names a modifier accepted by an editor shortcut.               |
| `TextDocument`              | Class | Stores text, positions, edits, search, and undo history.       |
| `TextDocumentChange`        | Type  | Describes the lines and characters changed by an edit.         |
| `Position`                  | Type  | Identifies a zero-based line and character.                    |
| `Range`                     | Type  | Identifies a start and end position.                           |
| `ResolvedTextEdit`          | Type  | Stores an edit with resolved document offsets.                 |
| `SelectionDirection`        | Type  | Selects backward, neutral, or forward selection direction.     |
| `TextEdit`                  | Type  | Replaces one range with new text.                              |
| `Marker`                    | Type  | Describes an editor diagnostic marker.                         |
| `MarkerSeverity`            | Type  | Selects an editor marker severity.                             |

## Lower-level exports

The edit entrypoint also exposes the state-management, keyboard-resolution,
marker-rendering, and popover-placement building blocks used by `Editor`.

| Export                                  | Kind     | Purpose                                                               |
| --------------------------------------- | -------- | --------------------------------------------------------------------- |
| `ManagedEditSession`                    | Type     | Selects mutable in-progress editor state by editor type.              |
| `ManagedFileEditSession`                | Type     | Holds mutable state for an active file editor session.                |
| `ManagedFileDiffEditSession`            | Type     | Holds mutable state for an active file-diff editor session.           |
| `cloneEditorViewState`                  | Function | Clones editor selections and viewport state.                          |
| `toManagedEditState`                    | Function | Returns complete edit state when a managed session has required data. |
| `resolveEditorCommandFromKeyboardEvent` | Function | Resolves a keyboard event through custom and default editor keymaps.  |
| `resolveFindAgainShortcut`              | Function | Recognizes the next or previous native find shortcut.                 |
| `MarkerRenderOptions`                   | Type     | Supplies marker rendering, measurement, and popover dependencies.     |
| `MarkerRenderer`                        | Class    | Renders marker ranges and marker hover popovers.                      |
| `markerSeverityDatasetKey`              | Function | Maps a marker severity to its DOM dataset key.                        |
| `POPOVER_BOUNDARY_LINES`                | Value    | Sets the document-edge fallback threshold for popover placement.      |
| `POPOVER_FLIP_HYSTERESIS_PX`            | Value    | Sets the clearance required before a flipped popover returns.         |
| `PopoverPlacementBounds`                | Type     | Describes vertical popover placement bounds.                          |
| `PopoverViewportBounds`                 | Type     | Describes all visible viewport edges for popover clamping.            |
| `PopoverManagerOptions`                 | Type     | Supplies active-popover state callbacks to `PopoverManager`.          |
| `PopoverManager`                        | Class    | Tracks viewport geometry and stable popover placement.                |
| `setPopoverPositionStyles`              | Function | Writes the CSS properties used to position and clamp a popover.       |

## `EditorOptions` fields

| Field                    | Purpose                                                  |
| ------------------------ | -------------------------------------------------------- |
| `historyMaxEntries`      | Limits the undo stack.                                   |
| `ownsVerticalViewport`   | Opts into vertical scroll retention at construction.     |
| `initialState`           | Supplies partial or complete state on first attach.      |
| `keymap`                 | Adds shortcut groups checked before the defaults.        |
| `roundedSelection`       | Controls rounded selection corners.                      |
| `matchBrackets`          | Controls matching-bracket highlights.                    |
| `autoSurround`           | Controls quote and bracket insertion around a selection. |
| `languageCommentConfig`  | Overrides comment tokens by language.                    |
| `enabledSelectionAction` | Enables the selection action surface.                    |
| `clipboard`              | Supplies a text clipboard reader.                        |
| `renderSelectionAction`  | Produces the selection action element.                   |
| `renderCaret`            | Produces an externally owned caret element.              |
| `onAttach`               | Receives the editor and attached surface.                |
| `onChange`               | Receives the event, including its editor instance.       |
| `onComplete`             | Observes the completed file or diff event.               |
| `onFocus`                | Runs after the editor gains focus.                       |
| `onBlur`                 | Runs after the editor loses focus.                       |

For a `file-diff` editor, view-only `initialState` can omit document and diff
metadata. Transferring an edited document and its undo/redo history requires the
matching `document`, `fileInfo`, and `diffSession` from one complete
`EditState`.

`onComplete` receives the exact frozen event that is also passed to the
component's `onEditComplete` or CodeView's `onItemEditComplete`. The editor
observer runs first and still runs when the component callback is missing. You
cannot accept or reject from this API. It is here for symmetry, but most
integrations should use those component callbacks instead.

Use `editStateKey` for ordinary same-runtime restoration. It retains the draft,
undo/redo history, selections, horizontal code scroll, eligible vertical scroll,
and FileDiff resume metadata without an application synchronization loop. It is
bounded in-memory state and does not survive a reload.

Use `getViewState()` and `setViewState()` for an isolated selection/view copy or
durable application persistence. An attached surface reports horizontal
`scrollLeft`. It reports `scrollTop` only when `ownsVerticalViewport: true` was
passed to the constructor and the surface exclusively owns an element viewport.
Virtualization alone does not imply ownership; page, ancestor, and CodeView
shared scrolling remain application/viewer state.

`getEditState()` exposes the raw objects from the latest complete edit-lifecycle
checkpoint. Checkpoints run after synchronization, document edits, explicit
`setViewState()` calls, recycling, and completion. Selection or scroll movement
alone does not update it; use `getViewState()` for an exact live copy. State
remains available while rendering is recycled and during `onComplete`, and
returns `undefined` before synchronization or after completion. The result is
borrowed editor-owned state rather than a serialization format.

## `Editor` members

| Member                                                   | Purpose                                                 |
| -------------------------------------------------------- | ------------------------------------------------------- |
| `new Editor(type, options?, editStateKey?)`              | Creates an editor with optional keyed state retention.  |
| `type`                                                   | Identifies the editor as `file` or `file-diff`.         |
| `edit(instance)`                                         | Attaches and returns the normal completion disposer.    |
| `setOptions(options)`                                    | Merges editor options.                                  |
| `applyEdits(edits, updateHistory?)`                      | Applies programmatic text edits.                        |
| `canUndo`                                                | Reports whether undo has an entry.                      |
| `canRedo`                                                | Reports whether redo has an entry.                      |
| `undo()`                                                 | Reverts the latest edit.                                |
| `redo()`                                                 | Reapplies the latest reverted edit.                     |
| `getFile()`                                              | Gets the current file contents.                         |
| `getText()`                                              | Gets the current text.                                  |
| `getViewState()`                                         | Gets selections and editor-owned view state.            |
| `setViewState(state)`                                    | Sets selections and editor-owned view state.            |
| `getEditState()`                                         | Gets the latest edit-lifecycle state checkpoint.        |
| `setSelections(selections)`                              | Sets directed selection ranges.                         |
| `setCarets(carets)`                                      | Replaces the externally owned caret and highlight list. |
| `setMarkers(markers)`                                    | Sets diagnostic markers.                                |
| `focus(options?)`                                        | Focuses the editor.                                     |
| `blur()`                                                 | Removes editor focus.                                   |
| `cleanUp(reason?: 'discard' \| 'recycle' \| 'complete')` | Suspends rendering or completes the editing session.    |

`editStateKey` opts an editor into retained in-memory sessions across editor
instances. File and file-diff namespaces are independent and each keeps up to
100 inactive entries by default. The same type/key cannot be active in two
editors at once.

Call the disposer returned by `edit(instance)` for the normal session-ending
path; it is equivalent to `cleanUp('complete')` and installs an accepted
completion result. `cleanUp('discard')` still publishes the completion event but
does not install its result. `cleanUp('recycle')` suspends rendering without
ending the session or changing the editor-component association. Calling
`edit(instance)` again resumes rendering for that same component.

## `EditStateManager` members

| Member                              | Purpose                                                         |
| ----------------------------------- | --------------------------------------------------------------- |
| `get(type, editStateKey)`           | Borrows active or inactive complete state without touching LRU. |
| `clear(type, editStateKey, parts?)` | Clears inactive complete or granular state.                     |
| `clearAll()`                        | Clears all inactive state without mutating active editors.      |
| `setCapacity(capacity)`             | Sets each namespace's inactive retained-state capacity.         |

`clear()` returns `false` for active or missing state. Omit `parts` to remove
the complete entry. `{ document: true }` also removes the complete entry because
all other parts depend on it. Use `{ history: true }`, `{ selections: true }`,
`{ view: true }`, or `{ editor: true }` to keep the document while clearing undo
history, cursor state, scroll state, or both view-state parts respectively.

For durable persistence, store `FileContents` and optional JSON-safe
`EditorViewState` separately, then construct a fresh `TextDocument` when
restoring. Complete `EditState` and undo/redo history are not serialization
contracts.

## `TextDocument` members

| Member                                               | Purpose                                               |
| ---------------------------------------------------- | ----------------------------------------------------- |
| `new TextDocument(uri, text, languageId?, version?)` | Creates a text document.                              |
| `uri`                                                | Gets the document identifier.                         |
| `languageId`                                         | Gets the language identifier.                         |
| `version`                                            | Gets the document version.                            |
| `lineCount`                                          | Gets the line count.                                  |
| `eol`                                                | Gets the line-ending sequence.                        |
| `canUndo`                                            | Reports whether undo has an entry.                    |
| `canRedo`                                            | Reports whether redo has an entry.                    |
| `positionAt(offset)`                                 | Converts an offset to a position.                     |
| `positionsAt(offsets)`                               | Converts several offsets to positions.                |
| `offsetAt(position)`                                 | Converts a position to an offset.                     |
| `getText(range?)`                                    | Gets all text or one range.                           |
| `getLineText(line, includeLineBreak?)`               | Gets one line.                                        |
| `normalizeEol(text)`                                 | Converts text to the document line ending.            |
| `getLineLength(line, includeLineBreak?)`             | Gets one line length.                                 |
| `charAt(offsetOrPosition)`                           | Gets one character.                                   |
| `getTextSlice(start, end)`                           | Gets text between two offsets.                        |
| `findNextNonOverlappingSubstring(needle, occupied)`  | Finds an unused substring range.                      |
| `search(params)`                                     | Finds text ranges.                                    |
| `applyEdits(edits, ...)`                             | Resolves and applies position-based edits.            |
| `resolveEdits(edits)`                                | Converts position-based edits to offset edits.        |
| `applyResolvedEdits(edits, ...)`                     | Applies offset-based edits.                           |
| `setLastUndoSelectionsAfter(selections)`             | Associates selections with the latest history entry.  |
| `setLastUndoLineAnnotations(before, after)`          | Associates annotations with the latest history entry. |
| `undo()`                                             | Reverts one document history entry.                   |
| `redo()`                                             | Reapplies one document history entry.                 |
| `normalizePosition(position)`                        | Clamps a position to the document.                    |
