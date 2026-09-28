---
'@mastra/playground-ui': minor
---

Added `FileDropBackdrop`, which wraps any field and shows a full-page "Drop to upload" empty state (customizable with `label` and `description`) while a file is dragged over the window. Dropped files matching the optional `accept` filter are passed to `onFilesDrop`.

```tsx
import { FileDropBackdrop } from '@mastra/playground-ui/components/FileDropBackdrop';

<FileDropBackdrop accept="image/*,.pdf" onFilesDrop={files => setAttachments(prev => [...prev, ...files])}>
  <Composer>…</Composer>
</FileDropBackdrop>;
```
