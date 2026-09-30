# Recipe: add line annotations and selection

Pass annotation data and a renderer to the surface:

```tsx
import type { DiffLineAnnotation } from '@pierre/diffs/react';
import { MultiFileDiff } from '@pierre/diffs/react';

const annotations: DiffLineAnnotation<{ message: string }>[] = [
  {
    side: 'additions',
    lineNumber: 8,
    metadata: { message: 'Review this line.' },
  },
];

<MultiFileDiff
  oldFile={oldFile}
  newFile={newFile}
  lineAnnotations={annotations}
  renderAnnotation={(annotation) => <p>{annotation.metadata.message}</p>}
  options={{
    enableLineSelection: true,
    onLineSelectionEnd(range) {
      saveSelection(range);
    },
  }}
/>;
```

Use `LineAnnotation` for a single file. Use `DiffLineAnnotation` for a diff.
Control the active selection with the `selectedLines` prop.
