# Shared types

This reference lists every export from the shared `@pierre/diffs` type module.
The root, React, and SSR entries re-export these types.

## Contents

- [Files and patches](#files-and-patches)
- [Themes and options](#themes-and-options)
- [Annotations and selection](#annotations-and-selection)
- [`CodeView` types](#codeview-types)
- [Lines, hunks, and render state](#lines-hunks-and-render-state)
- [Render results and virtualization](#render-results-and-virtualization)
- [Shiki and diff types](#shiki-and-diff-types)

## Files and patches

| Export                          | Purpose                                                           |
| ------------------------------- | ----------------------------------------------------------------- |
| `FileContents`                  | Describes a file name, text, language, header, and cache key.     |
| `DiffFileInput`                 | Accepts an old and new file for changes, additions, or deletions. |
| `MaybeDiffFileInput`            | Accepts a file pair or no file input.                             |
| `FileDiffContentsLoader`        | Loads complete files for partial diff metadata.                   |
| `FileDiffLoadedChangedFiles`    | Returns both files for a loaded changed diff.                     |
| `FileDiffLoadedPureRenamedFile` | Returns the new file for a loaded pure rename.                    |
| `FileDiffLoadedFiles`           | Represents either loaded-file result.                             |
| `ChangeTypes`                   | Names changed, renamed, added, or deleted file states.            |
| `ParsedPatch`                   | Holds patch metadata and parsed files.                            |
| `ContextContent`                | Describes one unchanged hunk block.                               |
| `ChangeContent`                 | Describes one additions and deletions block.                      |
| `Hunk`                          | Describes one parsed patch hunk.                                  |
| `FileDiffMetadata`              | Holds parsed file names, lines, hunks, and change metadata.       |
| `MergeConflictMarkerRowType`    | Names a merge conflict marker row.                                |
| `MergeConflictMarkerRow`        | Describes one marker row and its source line.                     |
| `MergeConflictRegion`           | Describes one parsed merge conflict region.                       |
| `MergeConflictResolution`       | Selects current, incoming, or both conflict contents.             |
| `MergeConflictActionPayload`    | Describes one conflict action and region.                         |
| `ProcessFileConflictData`       | Holds state while patch parsing processes conflicts.              |
| `ConflictResolverTypes`         | Names current, incoming, or both conflict choices.                |

## Themes and options

| Export                               | Purpose                                                      |
| ------------------------------------ | ------------------------------------------------------------ |
| `SupportedLanguages`                 | Accepts a bundled, text, ANSI, or custom language name.      |
| `HighlighterTypes`                   | Selects the JavaScript or WebAssembly Shiki engine.          |
| `HighlightedToken`                   | Stores a character index, foreground, and token text.        |
| `DiffsThemeNames`                    | Accepts a bundled or custom theme name.                      |
| `ThemesType`                         | Maps light and dark schemes to theme names.                  |
| `ThemeTypes`                         | Selects system, light, or dark mode.                         |
| `DiffsHighlighter`                   | Defines the package's configured Shiki highlighter.          |
| `BaseCodeOptions`                    | Configures themes, wrapping, headers, tokenization, and CSS. |
| `BaseDiffOptions`                    | Adds layout, indicators, context, and line diff options.     |
| `BaseDiffOptionsWithDefaults`        | Describes required diff options after defaults apply.        |
| `DiffIndicators`                     | Selects classic, bar, or hidden diff indicators.             |
| `HunkSeparators`                     | Selects the hunk separator presentation.                     |
| `LineDiffTypes`                      | Selects word, alternate word, character, or no inline diff.  |
| `FileHeaderRenderMode`               | Selects a default or custom file header.                     |
| `CustomPreProperties`                | Defines custom properties for the rendered `pre` element.    |
| `PrePropertiesConfig`                | Describes calculated `pre` element properties.               |
| `ExtensionFormatMap`                 | Maps file names or extensions to languages.                  |
| `RenderHeaderPrefixCallback`         | Produces prefix content for a diff header.                   |
| `RenderHeaderFilenameSuffixCallback` | Produces filename suffix content for a diff header.          |
| `RenderHeaderMetadataCallback`       | Produces metadata content for a diff header.                 |
| `RenderFileMetadata`                 | Produces header content for a file.                          |
| `PostRenderPhase`                    | Names mount, update, or unmount callback phases.             |

## Annotations and selection

| Export               | Purpose                                               |
| -------------------- | ----------------------------------------------------- |
| `AnnotationSide`     | Selects deletions or additions for an annotation.     |
| `LineAnnotation`     | Associates metadata with one file line.               |
| `DiffLineAnnotation` | Associates metadata with one side and line.           |
| `AnnotationLineMap`  | Groups diff annotations by line number.               |
| `SelectedLineRange`  | Describes a selected start and end across diff sides. |
| `SelectionSide`      | Selects deletions or additions for a selection.       |
| `SelectionPoint`     | Describes one line and optional side.                 |

## `CodeView` types

| Export                            | Purpose                                                  |
| --------------------------------- | -------------------------------------------------------- |
| `CodeViewFileItem`                | Describes one file item in a virtualized list.           |
| `CodeViewDiffItem`                | Describes one diff item in a virtualized list.           |
| `CodeViewItem`                    | Represents a file or diff list item.                     |
| `CodeViewCreateEditorOptions`     | Provides CodeView's routed editor option subset.         |
| `CodeViewItemEditCompleteHandler` | Handles completion with correlated event and item types. |
| `CodeViewScrollBehavior`          | Selects instant, smooth, or automatic smooth scroll.     |
| `CodeViewScrollTarget`            | Represents any supported list scroll target.             |
| `CodeViewPositionScrollTarget`    | Scrolls to an absolute list position.                    |
| `CodeViewLineScrollTarget`        | Scrolls to one item line.                                |
| `CodeViewRangeScrollTarget`       | Scrolls to one item line range.                          |
| `CodeViewItemScrollTarget`        | Scrolls to one item boundary.                            |
| `NumericScrollLineAnchor`         | Describes a numeric position inside a line.              |
| `CodeViewLayout`                  | Stores item offsets, heights, and total list height.     |
| `PendingCodeViewLayoutReset`      | Describes a deferred list layout reset.                  |
| `SmoothScrollSettings`            | Configures duration and distance for smooth list scroll. |

`CodeViewCreateEditorOptions` currently contains the routed `onChange(event)`
callback that `CodeView` uses to emit `onItemEditChange(event, item)`; it does
not add an item ID. A `CodeViewOptions.createEditor` factory also receives the
optional `editStateKey` returned by `getEditStateKey(item)` as its third
argument. Forward that key separately to the editor constructor. It retains the
editable draft, undo/redo history, selections, and horizontal code scroll. Item
editors never own CodeView's shared vertical position.

`onItemEditComplete(event, item, nextItem)` must return `'accept'` to accept the
completed item or `'reject'` to restore the original while the item remains
present; a missing callback rejects. During removal or teardown, neither
decision reinserts the item. Controlled owners must put the supplied `nextItem`
into their item state when accepting an item that should remain. If the item
uses keyed render caching, assigning a fresh `cacheKey` to the accepted event
file or diff invalidates that cache.

## Lines, hunks, and render state

| Export                       | Purpose                                                         |
| ---------------------------- | --------------------------------------------------------------- |
| `HunkLineType`               | Names context, expanded, addition, deletion, or metadata lines. |
| `HunkData`                   | Describes one hunk's render indexes and line ranges.            |
| `HunkExpansionRegion`        | Describes expanded context above and below a hunk.              |
| `ExpansionDirections`        | Selects up, down, or both expansion directions.                 |
| `DiffAcceptRejectHunkType`   | Selects accept, reject, or both hunk controls.                  |
| `DiffAcceptRejectHunkConfig` | Configures hunk accept and reject behavior.                     |
| `GapSpan`                    | Describes an empty row span.                                    |
| `AnnotationSpan`             | Describes an annotation row span.                               |
| `LineSpans`                  | Represents a gap or annotation span.                            |
| `LineTypes`                  | Names rendered context and change line classes.                 |
| `LineInfo`                   | Describes a rendered line number, side, and type.               |
| `CodeColumnType`             | Selects unified, additions, or deletions columns.               |
| `LineEventBaseProps`         | Supplies a file line to an interaction callback.                |
| `DiffLineEventBaseProps`     | Supplies a diff line and side to an interaction callback.       |
| `TokenEventBase`             | Supplies a token and source event.                              |
| `DiffTokenEventBaseProps`    | Adds diff side data to a token event.                           |
| `ObservedAnnotationNodes`    | Stores DOM nodes for observed annotations.                      |
| `ObservedGridNodes`          | Stores DOM nodes for observed grid columns.                     |
| `SharedRenderState`          | Holds shared token transformer render state.                    |
| `StickySpecs`                | Describes sticky header position and height.                    |

## Render results and virtualization

| Export                      | Purpose                                                 |
| --------------------------- | ------------------------------------------------------- |
| `RenderFileOptions`         | Defines the resolved options for a highlighted file.    |
| `RenderDiffOptions`         | Defines the resolved options for a highlighted diff.    |
| `ForceFilePlainTextOptions` | Selects a plain-text file range.                        |
| `ForceDiffPlainTextOptions` | Selects a plain-text diff range and hunk state.         |
| `ThemedFileResult`          | Holds the highlighted file syntax tree and line count.  |
| `ThemedDiffResult`          | Holds highlighted additions and deletions syntax trees. |
| `RenderDiffFilesResult`     | Holds the resolved old and new file inputs.             |
| `RenderFileResult`          | Holds file output and the options that produced it.     |
| `RenderDiffResult`          | Holds diff output and the options that produced it.     |
| `RenderedFileASTCache`      | Stores one cached file syntax tree by theme.            |
| `RenderedDiffASTCache`      | Stores one cached diff syntax tree by theme.            |
| `AppliedThemeStyleCache`    | Stores applied light and dark theme CSS.                |
| `RenderRange`               | Describes a start row, row count, and buffer sizes.     |
| `RenderWindow`              | Describes first and last rows in a render window.       |
| `VirtualWindowSpecs`        | Describes viewport position, height, and row window.    |
| `VirtualFileMetrics`        | Describes estimated header and line heights.            |

## Shiki and diff types

| Export                           | Purpose                                         |
| -------------------------------- | ----------------------------------------------- |
| `BundledLanguage`                | Names a language bundled by Shiki.              |
| `CodeToHastOptions`              | Configures Shiki code-to-HAST output.           |
| `DecorationItem`                 | Describes a Shiki source decoration.            |
| `LanguageRegistration`           | Describes a Shiki language grammar.             |
| `ShikiTransformer`               | Defines a Shiki syntax tree transformer.        |
| `ThemeRegistration`              | Describes a raw Shiki theme.                    |
| `ThemeRegistrationResolved`      | Describes a normalized Shiki theme.             |
| `ThemedToken`                    | Describes one Shiki token with its theme style. |
| `CreatePatchOptionsNonabortable` | Configures the underlying patch algorithm.      |
