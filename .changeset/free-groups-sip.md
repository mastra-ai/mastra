---
'@mastra/playground-ui': minor
---

Added `Tree.Input` component for inline file and folder creation within the Tree. Supports auto-focus, Enter to confirm, Escape to cancel, and blur handling with correct depth indentation.

```tsx
import { Tree } from '@mastra/playground-ui';

<Tree.Folder name="src" defaultOpen>
  <Tree.Input
    type="file"
    placeholder="new-file.ts"
    onSubmit={(name) => createFile(name)}
    onCancel={() => setCreating(false)}
  />
  <Tree.File name="index.ts" />
</Tree.Folder>
```
