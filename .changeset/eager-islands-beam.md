---
'@mastra/playground-ui': patch
---

Improved keyboard navigation and accessibility metadata in Tree.

Tree now supports roving keyboard focus across visible items, Arrow Right/Left folder expansion, and Enter/Space activation through the existing public API:

```tsx
<Tree>
  <Tree.Folder id="src" defaultOpen>
    <Tree.FolderTrigger>
      <Tree.Label>src</Tree.Label>
    </Tree.FolderTrigger>
    <Tree.FolderContent>
      <Tree.File id="src/index.ts">
        <Tree.Label>index.ts</Tree.Label>
      </Tree.File>
    </Tree.FolderContent>
  </Tree.Folder>
</Tree>
```
