# React API

This reference lists the React-specific exports from `@pierre/diffs/react`. The
entry also re-exports every type in [Shared types](api-types.md).

## Components and hooks

| Export                      | Kind      | Purpose                                                   |
| --------------------------- | --------- | --------------------------------------------------------- |
| `File`                      | Component | Renders one code file.                                    |
| `FileDiff`                  | Component | Renders pre-parsed diff metadata.                         |
| `MultiFileDiff`             | Component | Parses and renders an old and new file pair.              |
| `PatchDiff`                 | Component | Parses and renders one unified patch string.              |
| `UnresolvedFile`            | Component | Renders and resolves merge conflicts in one file.         |
| `CodeView`                  | Component | Renders a virtualized list of files and diffs.            |
| `Virtualizer`               | Component | Provides simple viewport virtualization.                  |
| `useVirtualizer`            | Hook      | Gets the nearest simple `Virtualizer` instance.           |
| `EditProvider`              | Component | Supplies an editor factory.                               |
| `useCreateEditor`           | Hook      | Gets the nearest editor factory.                          |
| `WorkerPoolContextProvider` | Component | Creates and supplies a worker pool.                       |
| `useWorkerPool`             | Hook      | Gets the nearest worker pool.                             |
| `useFileInstance`           | Hook      | Creates and manages a vanilla `File` instance.            |
| `useFileDiffInstance`       | Hook      | Creates and manages a vanilla `FileDiff` instance.        |
| `useStableCallback`         | Hook      | Returns a stable callback that reads the latest function. |

## Component and provider types

| Export                              | Purpose                                                           |
| ----------------------------------- | ----------------------------------------------------------------- |
| `FileProps`                         | Defines props for `File`.                                         |
| `FileOptions`                       | Defines vanilla file options and the React `options` prop.        |
| `FileDiffProps`                     | Defines props for `FileDiff`.                                     |
| `MultiFileDiffProps`                | Defines props for `MultiFileDiff`.                                |
| `PatchDiffProps`                    | Defines props for `PatchDiff`.                                    |
| `UnresolvedFileProps`               | Defines props for `UnresolvedFile`.                               |
| `UnresolvedFileReactOptions`        | Defines merge-conflict options for React.                         |
| `DiffBasePropsReact`                | Defines props shared by React diff components.                    |
| `CodeViewProps`                     | Defines controlled or uncontrolled `CodeView` props.              |
| `ControlledCodeViewProps`           | Defines `CodeView` props with `items`.                            |
| `UncontrolledCodeViewProps`         | Defines `CodeView` props with `initialItems`.                     |
| `CodeViewReactOptions`              | Defines the React-safe `CodeView` option set.                     |
| `CodeViewHandle`                    | Defines imperative list, selection, scroll, and editor controls.  |
| `EditorFactory`                     | Re-exports the editor factory type from `@pierre/diffs/edit`.     |
| `EditProviderProps`                 | Defines the type-aware `EditProvider` factory prop.               |
| `MergeConflictActionsTypeOption`    | Selects no actions, default actions, or a custom action renderer. |
| `RenderMergeConflictActionContext`  | Supplies conflict resolution to a custom action renderer.         |
| `RenderMergeConflictActions`        | Defines a custom conflict action renderer.                        |
| `WorkerInitializationRenderOptions` | Defines initial worker languages and render options.              |
| `WorkerPoolOptions`                 | Defines the worker factory, pool size, and cache size.            |

## Contexts and render helpers

| Export                    | Kind     | Purpose                                                |
| ------------------------- | -------- | ------------------------------------------------------ |
| `EditContext`             | Context  | Holds the editor factory.                              |
| `WorkerPoolContext`       | Context  | Holds the worker pool.                                 |
| `VirtualizerContext`      | Context  | Holds the simple virtualizer.                          |
| `GutterUtilitySlotStyles` | Value    | Supplies style keys for gutter utility slots.          |
| `MergeConflictSlotStyles` | Value    | Supplies style keys for merge conflict slots.          |
| `noopRender`              | Function | Returns no React output for an optional render slot.   |
| `renderDiffChildren`      | Function | Builds React portals for diff slots.                   |
| `renderFileChildren`      | Function | Builds React portals for file slots.                   |
| `templateRender`          | Function | Renders React content through a managed template slot. |
