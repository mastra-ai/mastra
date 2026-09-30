# Recipe: render with React

## Select a surface

| Input or layout                             | Component        |
| ------------------------------------------- | ---------------- |
| One `FileContents` object                   | `File`           |
| Old and new `FileContents` objects          | `MultiFileDiff`  |
| Existing `FileDiffMetadata`                 | `FileDiff`       |
| One unified patch string                    | `PatchDiff`      |
| One file with merge conflicts               | `UnresolvedFile` |
| One scroll region with many files and diffs | `CodeView`       |

Use `MultiFileDiff` when the app has old and new file contents:

```tsx
import { MultiFileDiff } from '@pierre/diffs/react';

<MultiFileDiff
  oldFile={{ name: 'src/value.ts', contents: oldSource }}
  newFile={{ name: 'src/value.ts', contents: newSource }}
  options={{
    diffStyle: 'split',
    theme: 'pierre-dark',
  }}
/>;
```

Pass source data, annotations, and slot renderers as component props. Pass
display, theme, interaction, and highlighting settings through `options`.

Keep file objects and option objects stable when their values do not change.
Wrap a large standalone surface in `Virtualizer`. Use `CodeView` when one scroll
region contains a list of files or diffs.

Use the matching preload function from `@pierre/diffs/ssr` when the server must
render the initial highlighted markup.
