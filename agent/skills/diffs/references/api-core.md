# Core API

This reference covers components, parsing, merge conflicts, and file extension
APIs from `@pierre/diffs`.

## Contents

- [File components](#file-components)
- [Virtualized components](#virtualized-components)
- [`File` members](#file-members)
- [`FileDiff` members](#filediff-members)
- [`CodeView` members](#codeview-members)
- [Parsing and patch APIs](#parsing-and-patch-apis)
- [Merge conflict APIs](#merge-conflict-apis)
- [Annotation APIs](#annotation-apis)
- [File extension APIs](#file-extension-apis)

## File components

| Export                                  | Kind     | Purpose                                                       |
| --------------------------------------- | -------- | ------------------------------------------------------------- |
| `File`                                  | Class    | Renders one syntax-highlighted file.                          |
| `FileOptions`                           | Type     | Configures file display, interaction, slots, and callbacks.   |
| `FileRenderProps`                       | Type     | Defines file input and a render target.                       |
| `FileHydrateProps`                      | Type     | Defines file input and preloaded markup for hydration.        |
| `FileDiff`                              | Class    | Renders a file diff from files or parsed metadata.            |
| `FileDiffOptions`                       | Type     | Configures diff display, interaction, slots, and callbacks.   |
| `FileDiffRenderBaseProps`               | Type     | Defines shared diff render input.                             |
| `FileDiffRenderProps`                   | Type     | Adds files or parsed metadata to diff render input.           |
| `FileDiffHydrationProps`                | Type     | Defines diff input and preloaded markup for hydration.        |
| `FileDiffType`                          | Type     | Identifies a standard or unresolved diff instance.            |
| `UnresolvedFile`                        | Class    | Renders one file with merge conflict controls.                |
| `UnresolvedFileOptions`                 | Type     | Configures merge conflict display and callbacks.              |
| `UnresolvedFileRenderProps`             | Type     | Defines merge conflict render input.                          |
| `UnresolvedFileHydrationProps`          | Type     | Defines merge conflict input for hydration.                   |
| `MergeConflictActionsTypeOption`        | Type     | Selects no actions, default actions, or a custom renderer.    |
| `RenderMergeConflictActions`            | Type     | Defines a vanilla conflict action renderer.                   |
| `getUnresolvedDiffHunksRendererOptions` | Function | Converts unresolved-file options to hunk renderer options.    |
| `CodeView`                              | Class    | Renders a virtualized list of files and diffs.                |
| `CodeViewOptions`                       | Type     | Configures list layout, items, slots, selection, and editing. |
| `CodeViewLineSelection`                 | Type     | Associates a selected range with one item ID.                 |
| `CodeViewRenderedFileItem`              | Type     | Describes one mounted file item.                              |
| `CodeViewRenderedDiffItem`              | Type     | Describes one mounted diff item.                              |
| `CodeViewRenderedItem`                  | Type     | Represents a mounted file or diff item.                       |
| `CodeViewCoordinator`                   | Type     | Coordinates React slots with the vanilla list.                |
| `CodeViewSlotSnapshot`                  | Type     | Describes mounted items and list header or footer hosts.      |
| `CodeViewScrollListener`                | Type     | Receives list scroll changes.                                 |
| `CODE_VIEW_FILE_OPTION_KEYS`            | Value    | Lists file options that `CodeView` passes to an item.         |
| `CODE_VIEW_DIFF_OPTION_KEYS`            | Value    | Lists diff options that `CodeView` passes to an item.         |

## Virtualized components

| Export                                             | Kind  | Purpose                                                     |
| -------------------------------------------------- | ----- | ----------------------------------------------------------- |
| `Virtualizer`                                      | Class | Tracks a simple viewport and connected render instances.    |
| `VirtualizerConfig`                                | Type  | Configures overscroll, observation margin, and resize logs. |
| `VirtualizedFile`                                  | Class | Adds simple viewport behavior to `File`.                    |
| `VirtualizedFileDiff`                              | Class | Adds simple viewport behavior to `FileDiff`.                |
| `VIRTUALIZED_FILE_DIFF_LAYOUT_CHECKPOINT_INTERVAL` | Value | Sets the line interval for virtual diff layout checkpoints. |

## `File` members

| Member                                        | Purpose                                              |
| --------------------------------------------- | ---------------------------------------------------- |
| `new File(options?, workerManager?)`          | Creates one file renderer.                           |
| `render(props)`                               | Renders file contents.                               |
| `hydrate(props)`                              | Attaches to preloaded file markup.                   |
| `rerender()`                                  | Renders the current file again.                      |
| `setOptions(options)`                         | Replaces file options.                               |
| `setThemeType(themeType)`                     | Selects system, light, or dark theme mode.           |
| `onThemeChange()`                             | Applies a changed theme.                             |
| `setLineAnnotations(annotations)`             | Replaces file annotations.                           |
| `setSelectedLines(range, options?)`           | Replaces the selected line range.                    |
| `setEditorActiveLine(line, options?)`         | Marks the editor's active line.                      |
| `getHoveredLine()`                            | Gets the current hovered line.                       |
| `getOrCreateLineCache(file?)`                 | Gets cached source lines.                            |
| `attachEditor(editor)`                        | Attaches an editor and returns a detach function.    |
| `applyDocumentChange(document, annotations?)` | Applies an editor document update.                   |
| `updateRenderCache(tokens, themeType)`        | Updates highlighted token cache entries.             |
| `primeHighlightCache()`                       | Preloads the highlighted file result.                |
| `renderPlaceholder(height)`                   | Renders a fixed-height placeholder.                  |
| `virtualizedSetup()`                          | Prepares the instance for a virtualizer.             |
| `flushManagers()`                             | Applies deferred interaction and size manager state. |
| `cleanUp(recycle?)`                           | Releases rendered resources.                         |

## `FileDiff` members

`FileDiff` supports the shared `File` update, selection, annotation, editor,
hydration, placeholder, and cleanup members with diff data.

| Member                                       | Purpose                                          |
| -------------------------------------------- | ------------------------------------------------ |
| `new FileDiff(options?, workerManager?)`     | Creates one diff renderer.                       |
| `render(props)`                              | Parses or renders diff input.                    |
| `hydrate(props)`                             | Attaches to preloaded diff markup.               |
| `rerender()`                                 | Renders the current diff again.                  |
| `setOptions(options)`                        | Replaces diff options.                           |
| `getLineIndex(line, side?)`                  | Maps a displayed line to row and column indexes. |
| `handleExpandHunk(index, direction, count?)` | Handles a hunk expansion request.                |
| `expandHunk(index, direction, count?)`       | Expands hidden context around one hunk.          |
| `completeEditSession()`                      | Recomputes diff metadata after an edit session.  |
| `isLineRenderable(line)`                     | Tests whether an additions line is visible.      |
| `getNearestRenderableLine(line, direction)`  | Finds a visible additions line.                  |
| `revealLine(line)`                           | Expands context to show an additions line.       |
| `primeHighlightCache(diff?)`                 | Preloads the highlighted diff result.            |

## `CodeView` members

| Member                                   | Purpose                                      |
| ---------------------------------------- | -------------------------------------------- |
| `new CodeView(options?, workerManager?)` | Creates one virtualized list.                |
| `setup(root)`                            | Attaches the list to its scroll root.        |
| `setItems(items)`                        | Replaces all items.                          |
| `addItem(item)`                          | Appends one item.                            |
| `addItems(items)`                        | Appends several items.                       |
| `getItem(id)`                            | Gets one item by ID.                         |
| `updateItem(item)`                       | Replaces one item by ID.                     |
| `updateItemId(oldId, newId)`             | Changes one item ID.                         |
| `getEditor(id)`                          | Gets the active editor for an item.          |
| `scrollTo(target)`                       | Scrolls to a position, item, line, or range. |
| `setSelectedLines(selection, options?)`  | Sets the selected item and range.            |
| `getSelectedLines()`                     | Gets the selected item and range.            |
| `clearSelectedLines(options?)`           | Clears the selected lines.                   |
| `setOptions(options)`                    | Replaces list options.                       |
| `onThemeChange()`                        | Applies a changed theme to list items.       |
| `render(immediate?)`                     | Schedules or performs a render.              |
| `getWindowSpecs()`                       | Gets the current virtual window.             |
| `getContainerElement()`                  | Gets the scroll content element.             |
| `getHeaderElement()`                     | Gets the list header host.                   |
| `getFooterElement()`                     | Gets the list footer host.                   |
| `getRenderedItems()`                     | Gets mounted items.                          |
| `setSlotCoordinator(coordinator?)`       | Sets the external slot coordinator.          |
| `getSlotSnapshot(coordinator)`           | Gets the coordinator's mounted slot state.   |
| `subscribeToScroll(listener)`            | Subscribes to scroll changes.                |
| `getLocalTopForInstance(instance)`       | Gets an instance offset inside the list.     |
| `getTopForItem(id)`                      | Gets an item offset inside the list.         |
| `instanceChanged(instance, layoutDirty)` | Reports a render instance change.            |
| `reset()`                                | Clears items and render state.               |
| `cleanUp()`                              | Releases list resources.                     |

## Parsing and patch APIs

| Export                       | Purpose                                               |
| ---------------------------- | ----------------------------------------------------- |
| `parseDiffFromFile`          | Creates `FileDiffMetadata` from old and new files.    |
| `parsePatchFiles`            | Parses a patch string into file diff metadata.        |
| `processPatch`               | Parses one patch section.                             |
| `processFile`                | Converts one parsed patch file to `FileDiffMetadata`. |
| `getSingularPatch`           | Selects one file patch from a patch string.           |
| `trimPatchContext`           | Limits unchanged context in patch text.               |
| `hydratePartialDiff`         | Adds loaded file contents to partial diff metadata.   |
| `cloneFileDiffMetadata`      | Creates a structural copy of diff metadata.           |
| `cleanLastNewline`           | Normalizes the final newline for diff input.          |
| `getLineEndingType`          | Detects a file's line-ending sequence.                |
| `getTotalLineCountFromHunks` | Counts rendered rows across hunks.                    |
| `parseLineType`              | Parses one patch line marker and content.             |
| `ParsedLine`                 | Describes the result from `parseLineType`.            |

## Merge conflict APIs

| Export                 | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `resolveConflict`      | Applies one current, incoming, or combined conflict resolution. |
| `resolveRegion`        | Resolves one parsed merge conflict region.                      |
| `diffAcceptRejectHunk` | Applies accept or reject behavior to one change hunk.           |

## Annotation APIs

| Export                       | Purpose                                                    |
| ---------------------------- | ---------------------------------------------------------- |
| `isFileAnnotation`           | Tests whether one annotation targets a file line.          |
| `isDiffAnnotation`           | Tests whether one annotation targets a diff side and line. |
| `isFileAnnotationCollection` | Tests whether an array contains file annotations.          |
| `isDiffAnnotationCollection` | Tests whether an array contains diff annotations.          |

## File extension APIs

| Export                       | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| `getFiletypeFromFileName`    | Infers a language from a file name.              |
| `setCustomExtension`         | Maps one file name or extension to a language.   |
| `replaceCustomExtensions`    | Replaces all custom mappings.                    |
| `getCustomExtensionsMap`     | Gets a copy of custom mappings.                  |
| `getCustomExtensionsVersion` | Gets the mapping revision.                       |
| `EXTENSION_TO_FILE_FORMAT`   | Maps built-in extensions and names to languages. |
| `setLanguageOverride`        | Assigns a language to parsed diff files.         |
