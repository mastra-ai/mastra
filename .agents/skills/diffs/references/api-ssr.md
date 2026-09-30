# SSR API

This reference lists the SSR-specific exports from `@pierre/diffs/ssr`. The
entry also re-exports every type in [Shared types](api-types.md).

## Functions

| Export                      | Purpose                                                       |
| --------------------------- | ------------------------------------------------------------- |
| `preloadFile`               | Renders one file and returns props with `prerenderedHTML`.    |
| `preloadFileDiff`           | Renders pre-parsed diff metadata and returns component props. |
| `preloadMultiFileDiff`      | Parses and renders an old and new file pair.                  |
| `preloadPatchDiff`          | Parses and renders one patch for `PatchDiff`.                 |
| `preloadPatchFile`          | Parses a multi-file patch and returns one result per file.    |
| `preloadUnresolvedFile`     | Renders one merge-conflict file and returns component props.  |
| `preloadDiffHTML`           | Renders a diff directly to an HTML string.                    |
| `preloadUnresolvedFileHTML` | Renders a merge-conflict file directly to an HTML string.     |
| `renderHTML`                | Serializes rendered HAST elements to HTML.                    |

## Types

| Export                         | Purpose                                                  |
| ------------------------------ | -------------------------------------------------------- |
| `PreloadFileOptions`           | Defines input for `preloadFile`.                         |
| `PreloadedFileResult`          | Adds `prerenderedHTML` to file input.                    |
| `PreloadDiffOptions`           | Defines parsed or file-pair input for `preloadDiffHTML`. |
| `PreloadFileDiffOptions`       | Defines input for `preloadFileDiff`.                     |
| `PreloadFileDiffResult`        | Adds `prerenderedHTML` to parsed diff input.             |
| `PreloadMultiFileDiffOptions`  | Defines input for `preloadMultiFileDiff`.                |
| `PreloadMultiFileDiffResult`   | Adds `prerenderedHTML` to file-pair input.               |
| `PreloadPatchDiffOptions`      | Defines input for `preloadPatchDiff`.                    |
| `PreloadPatchDiffResult`       | Adds `prerenderedHTML` to patch input.                   |
| `PreloadPatchFileOptions`      | Defines input for `preloadPatchFile`.                    |
| `PreloadUnresolvedFileOptions` | Defines input for `preloadUnresolvedFile`.               |
| `PreloadUnresolvedFileResult`  | Adds `prerenderedHTML` to merge-conflict input.          |
