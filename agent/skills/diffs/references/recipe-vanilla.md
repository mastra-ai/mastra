# Recipe: render with vanilla JavaScript

## Select a surface

| Input or layout                             | Class                 |
| ------------------------------------------- | --------------------- |
| One `FileContents` object                   | `File`                |
| Existing or parsed `FileDiffMetadata`       | `FileDiff`            |
| One file with merge conflicts               | `UnresolvedFile`      |
| One large file                              | `VirtualizedFile`     |
| One large diff                              | `VirtualizedFileDiff` |
| One scroll region with many files and diffs | `CodeView`            |

Parse the files, create the view, and render it into a host:

```ts
import { FileDiff, parseDiffFromFile } from '@pierre/diffs';

const host = document.querySelector<HTMLElement>('#diff');
if (host == null) throw new Error('Missing diff host');

const fileDiff = parseDiffFromFile(
  { name: 'src/value.ts', contents: oldSource },
  { name: 'src/value.ts', contents: newSource }
);

const view = new FileDiff({
  diffStyle: 'split',
  theme: 'pierre-dark',
});

view.render({ fileContainer: host, fileDiff });
```

Keep the class instance while the host remains mounted. Call `render` again when
the source data changes. Call `setOptions`, `setThemeType`,
`setLineAnnotations`, or `setSelectedLines` for targeted updates.

Use a `Virtualizer` with `VirtualizedFile` or `VirtualizedFileDiff` for one
large surface. Use `CodeView` for a list that shares one scroll region. Call
`cleanUp()` when the host removes the surface.
