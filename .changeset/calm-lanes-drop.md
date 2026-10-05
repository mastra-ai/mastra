---
'@mastra/playground-ui': minor
---

Added `useDropZone` to turn any element into a native drop target for one drag type. It reports while an accepted drag is over the element and hands the dropped data to your handler. Drags of other types, such as files, pass through untouched.

```tsx
import { useDropZone } from '@mastra/playground-ui/hooks/use-drop-zone';

const { isDragOver, dropZoneProps } = useDropZone({
  accept: 'application/x-task',
  dropEffect: 'move',
  onDrop: dataTransfer => moveTask(dataTransfer.getData('application/x-task')),
});

<section className={isDragOver ? 'bg-fill-hover' : undefined} {...dropZoneProps} />;
```
