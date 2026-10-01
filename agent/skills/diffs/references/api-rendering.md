# Low-level rendering API

This reference lists the renderer, manager, DOM helper, comparison, and constant
exports from `@pierre/diffs`.

## Contents

- [Renderers](#renderers)
- [Interaction manager](#interaction-manager)
- [Size, scroll, and render managers](#size-scroll-and-render-managers)
- [Comparison helpers](#comparison-helpers)
- [Syntax tree and DOM helpers](#syntax-tree-and-dom-helpers)
- [Layout and CSS helpers](#layout-and-css-helpers)
- [Constants](#constants)

## Renderers

| Export                                 | Kind  | Purpose                                                 |
| -------------------------------------- | ----- | ------------------------------------------------------- |
| `FileRenderer`                         | Class | Converts one file to highlighted HAST, CSS, and HTML.   |
| `FileRendererOptions`                  | Type  | Adds header mode to base code options.                  |
| `FileRenderResult`                     | Type  | Holds file HAST, CSS, row counts, and buffers.          |
| `DiffHunksRenderer`                    | Class | Converts diff hunks to highlighted column HAST and CSS. |
| `DiffHunksRendererOptions`             | Type  | Configures one hunk renderer.                           |
| `DiffHunksRendererOptionsWithDefaults` | Type  | Describes resolved hunk renderer options.               |
| `HunksRenderResult`                    | Type  | Holds rendered diff columns, metadata, and row count.   |
| `RenderedLineContext`                  | Type  | Supplies line state to a line decoration.               |
| `LineDecoration`                       | Type  | Defines a custom line wrapper and injected rows.        |
| `InjectedRow`                          | Type  | Defines one row inserted around a unified line.         |
| `SplitInjectedRow`                     | Type  | Defines one row inserted around a split line.           |
| `UnifiedInjectedRowPlacement`          | Type  | Selects placement before or after a unified row.        |
| `SplitInjectedRowPlacement`            | Type  | Selects side and placement for a split row.             |
| `UnifiedLineDecorationProps`           | Type  | Supplies one unified row to a decoration.               |
| `SplitLineDecorationProps`             | Type  | Supplies paired split rows to a decoration.             |

## Interaction manager

| Export                          | Kind     | Purpose                                                                  |
| ------------------------------- | -------- | ------------------------------------------------------------------------ |
| `InteractionManager`            | Class    | Handles hover, token, gutter, and line selection events.                 |
| `InteractionManagerMode`        | Type     | Selects file or diff interaction data.                                   |
| `InteractionManagerBaseOptions` | Type     | Defines interaction callbacks and enabled features.                      |
| `InteractionManagerOptions`     | Type     | Adds required DOM access to base interaction options.                    |
| `GetHoveredLineResult`          | Type     | Describes the current hovered file or diff line.                         |
| `GetLineIndexUtility`           | Type     | Maps a logical line to row and column indexes.                           |
| `OnLineClickProps`              | Type     | Describes a file line click.                                             |
| `OnLineEnterLeaveProps`         | Type     | Describes file line pointer entry or exit.                               |
| `OnDiffLineClickProps`          | Type     | Describes a diff line click.                                             |
| `OnDiffLineEnterLeaveProps`     | Type     | Describes diff line pointer entry or exit.                               |
| `OnTokenEventProps`             | Type     | Selects file or diff token event data.                                   |
| `SelectionWriteOptions`         | Type     | Configures callback emission, the active side, and line-only highlights. |
| `MergeConflictActionTarget`     | Type     | Describes a merge conflict action element.                               |
| `LogTypes`                      | Type     | Selects interaction log categories.                                      |
| `pluckInteractionOptions`       | Function | Selects interaction fields from component options.                       |

## Size, scroll, and render managers

| Export                            | Kind     | Purpose                                                       |
| --------------------------------- | -------- | ------------------------------------------------------------- |
| `ResizeManager`                   | Class    | Measures rows, annotations, and column CSS values.            |
| `ResizeManagerColumnVariableMode` | Type     | Selects column variable measurement or application.           |
| `ResizeManagerSetupOptions`       | Type     | Configures annotation and column measurement.                 |
| `ScrollSyncManager`               | Class    | Synchronizes additions and deletions column scroll positions. |
| `queueRender`                     | Function | Adds a callback to the shared animation render queue.         |
| `dequeueRender`                   | Function | Removes a callback from the shared render queue.              |
| `clearRenderQueue`                | Function | Removes all callbacks from the shared render queue.           |

## Comparison helpers

| Export                        | Purpose                                           |
| ----------------------------- | ------------------------------------------------- |
| `areDiffLineAnnotationsEqual` | Compares two diff annotation arrays.              |
| `areLineAnnotationsEqual`     | Compares two file annotation arrays.              |
| `areDiffRenderOptionsEqual`   | Compares resolved diff render options.            |
| `areFileRenderOptionsEqual`   | Compares resolved file render options.            |
| `areDiffTargetsEqual`         | Compares two diff interaction targets.            |
| `areFilesEqual`               | Compares two file inputs.                         |
| `areHunkDataEqual`            | Compares two hunk data objects.                   |
| `areObjectsEqual`             | Performs the package's shallow object comparison. |
| `areOptionsEqual`             | Compares component option objects.                |
| `arePrePropertiesEqual`       | Compares calculated `pre` properties.             |
| `areRenderRangesEqual`        | Compares two render ranges.                       |
| `areSelectionsEqual`          | Compares editor selection arrays.                 |
| `areThemesEqual`              | Compares theme names or light/dark pairs.         |
| `areVirtualWindowSpecsEqual`  | Compares two virtual window descriptions.         |
| `areWorkerStatsEqual`         | Compares two worker statistics objects.           |

## Syntax tree and DOM helpers

| Export                           | Kind     | Purpose                                                    |
| -------------------------------- | -------- | ---------------------------------------------------------- |
| `createAnnotationElement`        | Function | Creates a HAST annotation row from an annotation span.     |
| `createAnnotationWrapperNode`    | Function | Creates a DOM host for an annotation slot.                 |
| `createDiffSpanDecoration`       | Function | Creates one Shiki inline diff decoration.                  |
| `pushOrJoinSpan`                 | Function | Adds or joins one inline diff span.                        |
| `createEmptyRowBuffer`           | Function | Creates an empty virtual row buffer.                       |
| `createFileHeaderElement`        | Function | Creates a file or diff header HAST element.                |
| `CreateFileHeaderElementProps`   | Type     | Defines header source, mode, and sticky state.             |
| `createGutterGap`                | Function | Creates a gutter gap HAST element.                         |
| `createGutterItem`               | Function | Creates a gutter item HAST element.                        |
| `createGutterWrapper`            | Function | Creates a gutter wrapper HAST element.                     |
| `createGutterUtilityElement`     | Function | Creates a gutter utility HAST element.                     |
| `createGutterUtilityContentNode` | Function | Creates a gutter utility DOM content host.                 |
| `createHastElement`              | Function | Creates a typed HAST element.                              |
| `createIconElement`              | Function | Creates a sprite icon HAST element.                        |
| `createTextNodeElement`          | Function | Creates a HAST text node.                                  |
| `createNoNewlineElement`         | Function | Creates the missing-final-newline HAST element.            |
| `createPreElement`               | Function | Creates the outer HAST `pre` element.                      |
| `createPreWrapperProperties`     | Function | Creates HAST properties for a `pre` wrapper.               |
| `createRowNodes`                 | Function | Creates DOM row and content elements for one line.         |
| `createSeparator`                | Function | Creates a hunk separator HAST element.                     |
| `createSpanFromToken`            | Function | Creates a HAST span from one highlighted token.            |
| `createStyleElement`             | Function | Creates a DOM style element with an attribute marker.      |
| `createThemeStyleElement`        | Function | Creates a marked theme style element.                      |
| `createUnsafeCSSStyleNode`       | Function | Creates a marked custom CSS style element.                 |
| `findCodeElement`                | Function | Finds the code element in a HAST tree.                     |
| `getLineNodes`                   | Function | Gets rendered line nodes from a HAST root.                 |
| `getOrCreateCodeNode`            | Function | Reuses or creates a code column DOM node.                  |
| `getLineAnnotationName`          | Function | Creates the slot name for a line annotation.               |
| `getHunkSeparatorSlotName`       | Function | Creates the slot name for a hunk separator.                |
| `getIconForType`                 | Function | Maps a file change type to a sprite icon.                  |
| `processLine`                    | Function | Applies line render state to one HAST line.                |
| `setPreNodeProperties`           | Function | Applies resolved render properties to a DOM `pre` element. |
| `prerenderHTMLIfNecessary`       | Function | Adds preloaded HTML to an empty host element.              |

## Layout and CSS helpers

| Export                           | Purpose                                                       |
| -------------------------------- | ------------------------------------------------------------- |
| `createWindowFromScrollPosition` | Calculates a virtual window from scroll measurements.         |
| `isDefaultRenderRange`           | Tests whether a render range covers the default full range.   |
| `prefersReducedMotion`           | Reads the reduced-motion media preference.                    |
| `formatCSSVariablePrefix`        | Creates the global or token CSS variable prefix.              |
| `wrapCoreCSS`                    | Places core CSS in its cascade layer.                         |
| `wrapThemeCSS`                   | Places theme CSS in its layer and mode selector.              |
| `wrapUnsafeCSS`                  | Places custom CSS in its cascade layer.                       |
| `patchScrollbarGutterSize`       | Updates the measured scrollbar gutter in theme CSS.           |
| `detachString`                   | Copies a retained substring to an independent backing string. |
| `releaseStringDetachBuffer`      | Resets the reusable string copy buffer.                       |
| `SVGSpriteSheet`                 | Contains the SVG symbols used by rendered controls.           |
| `SVGSpriteNames`                 | Names a symbol in `SVGSpriteSheet`.                           |

## Constants

| Export                                     | Purpose                                               |
| ------------------------------------------ | ----------------------------------------------------- |
| `DEFAULT_THEMES`                           | Provides the default light and dark theme names.      |
| `DEFAULT_TOKENIZE_MAX_LENGTH`              | Provides the default total tokenization limit.        |
| `DEFAULT_COLLAPSED_CONTEXT_THRESHOLD`      | Provides the default hidden-context threshold.        |
| `DEFAULT_EXPANDED_REGION`                  | Provides the default hunk expansion state.            |
| `DEFAULT_RENDER_RANGE`                     | Provides the full render range.                       |
| `EMPTY_RENDER_RANGE`                       | Provides an empty render range.                       |
| `DEFAULT_VIRTUAL_FILE_METRICS`             | Provides estimated file header and line heights.      |
| `DEFAULT_CODE_VIEW_FILE_METRICS`           | Provides list item height estimates.                  |
| `DEFAULT_CODE_VIEW_LAYOUT`                 | Provides an empty list layout.                        |
| `DEFAULT_SMOOTH_SCROLL_SETTINGS`           | Provides the default smooth scroll settings.          |
| `DIFFS_TAG_NAME`                           | Provides the `diffs-container` custom element name.   |
| `CORE_CSS_ATTRIBUTE`                       | Provides the core style marker attribute.             |
| `THEME_CSS_ATTRIBUTE`                      | Provides the theme style marker attribute.            |
| `UNSAFE_CSS_ATTRIBUTE`                     | Provides the custom style marker attribute.           |
| `DIFFS_SCROLLBAR_MEASURE_ATTRIBUTE`        | Provides the scrollbar measurement attribute.         |
| `DIFFS_SCROLLBAR_GUTTER_MEASURED_PROPERTY` | Provides the measured scrollbar CSS property.         |
| `CODE_VIEW_HEADER_ATTRIBUTE`               | Provides the list header host attribute.              |
| `CODE_VIEW_FOOTER_ATTRIBUTE`               | Provides the list footer host attribute.              |
| `CUSTOM_HEADER_SLOT_ID`                    | Provides the custom header slot ID.                   |
| `HEADER_PREFIX_SLOT_ID`                    | Provides the header prefix slot ID.                   |
| `HEADER_FILENAME_SUFFIX_SLOT_ID`           | Provides the filename suffix slot ID.                 |
| `HEADER_METADATA_SLOT_ID`                  | Provides the header metadata slot ID.                 |
| `HUNK_HEADER`                              | Provides the patch hunk header marker.                |
| `FILE_CONTEXT_BLOB`                        | Matches a patch hunk boundary.                        |
| `INDEX_LINE_METADATA`                      | Provides the patch index metadata marker.             |
| `COMMIT_METADATA_SPLIT`                    | Provides the commit metadata separator expression.    |
| `FILENAME_HEADER_REGEX`                    | Matches a standard patch file header.                 |
| `GIT_DIFF_FILE_BREAK_REGEX`                | Matches a Git patch file boundary.                    |
| `UNIFIED_DIFF_FILE_BREAK_REGEX`            | Matches a unified patch file boundary.                |
| `MERGE_CONFLICT_START_MARKER_REGEX`        | Matches a conflict start marker.                      |
| `MERGE_CONFLICT_BASE_MARKER_REGEX`         | Matches a conflict base marker.                       |
| `MERGE_CONFLICT_SEPARATOR_MARKER_REGEX`    | Matches a conflict separator marker.                  |
| `MERGE_CONFLICT_END_MARKER_REGEX`          | Matches a conflict end marker.                        |
| `SPLIT_WITH_NEWLINES`                      | Splits text while it preserves newline tokens.        |
| `DIFFS_DEVELOPMENT_BUILD`                  | Reports whether the package uses a development build. |
