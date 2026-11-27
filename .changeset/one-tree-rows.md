---
'@mastra/playground-ui': major
---

`Tree` now draws only the rows in view, so a folder with thousands of files opens without freezing the page. On a 5,000-file folder the slowest frame went from 3.8 s to under 100 ms.

**Breaking:** `Tree` takes a flat list of rows instead of nested `Tree.Folder` and `Tree.File` children. `Tree.Folder`, `Tree.FolderTrigger`, `Tree.FolderContent` and `Tree.File` are removed. `Tree.Icon`, `Tree.Label` and `Tree.Input` stay as the parts of a row. `flattenTreeRows` turns nested data into rows.

```tsx
// Before
<Tree selectedId={selected} onSelect={setSelected}>
  <Tree.Folder defaultOpen>
    <Tree.FolderTrigger>
      <Tree.Label>src</Tree.Label>
    </Tree.FolderTrigger>
    <Tree.FolderContent>
      <Tree.File id="src/index.ts">
        <Tree.Label>index.ts</Tree.Label>
      </Tree.File>
    </Tree.FolderContent>
  </Tree.Folder>
</Tree>;

// After
import { Tree, flattenTreeRows } from '@mastra/playground-ui/components/Tree';

<Tree
  aria-label="Files"
  rows={flattenTreeRows(nodes, {
    getId: node => node.path,
    getChildren: node => node.children,
    isOpen: path => open.has(path),
  })}
  getRowLabel={row => row.node.name}
  selectedId={selected}
  onActivate={row => (row.expanded === undefined ? setSelected(row.id) : setOpen(row.id, !row.expanded))}
  onExpandedChange={(row, expanded) => setOpen(row.id, expanded)}
  renderRow={row => <Tree.Label>{row.node.name}</Tree.Label>}
/>;
```

`size="md"` gives taller rows for navigation trees, like the Knowledge sidebar. A row selected from outside the tree (a graph or search) scrolls into view a third of the way down, unless the person already scrolled or clicked in the tree.

Typing the start of a name jumps to that row, even one that isn't drawn yet. The browser's find in page (Cmd+F or Ctrl+F) finds rows that are scrolled out of view and scrolls to them, in browsers that support `hidden="until-found"`.
