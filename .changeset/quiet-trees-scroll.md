---
'@mastra/playground-ui': minor
---

Added `VirtualTree`, a tree that draws only the rows in view, and moved the workspace file tree onto it. A folder with thousands of files now opens without freezing the page: on a 5,000-file folder the slowest frame went from 3.8 s to under 100 ms. Keyboard follows the WAI-ARIA tree pattern with one tab stop.

```tsx
import { VirtualTree } from '@mastra/playground-ui/components/VirtualTree';

<VirtualTree
  aria-label="Files"
  rows={rows}
  selectedId={selectedPath}
  onActivate={row => openOrSelect(row)}
  onExpandedChange={(row, expanded) => setOpen(row.id, expanded)}
  renderRow={row => <FileRowContent row={row} />}
/>;
```
