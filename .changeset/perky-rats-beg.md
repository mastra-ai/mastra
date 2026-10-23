---
'@mastra/playground-ui': minor
---

`CodeDiff` can now carry a file header. Pass `header` with the file's `path` and it shows above the diff, with an optional `icon` before the path (the kind of change), your own `meta` (line counts) on the right, and a chevron that folds the diff away. `previousPath` adds a "from" line for renamed or moved files. With a header and no `patch`, the card shows the header alone, for files with no diff to show such as binaries or oversized changes.

Added `CodeDiffList`, a scroll container for many `CodeDiff`s. It stacks them edge to edge with a divider between files, the way a pull request does, and only renders the diff lines in view, so a change set with hundreds of files stays fast. Each file header stays pinned while you scroll through its diff.

```tsx
import { CodeDiff, CodeDiffList } from '@mastra/playground-ui/components/CodeDiff';
import { DiffStat } from '@mastra/playground-ui/components/DiffStat';
import { SquareArrowRight } from 'lucide-react';

<CodeDiffList className="h-[640px]">
  <CodeDiff
    patch={agentPatch}
    overflow="scroll"
    header={{ path: 'src/agent.ts', meta: <DiffStat additions={4} deletions={1} /> }}
  />
  <CodeDiff
    header={{
      path: 'src/agents/helper.ts',
      previousPath: 'src/helper.ts',
      icon: <SquareArrowRight role="img" aria-label="Renamed" />,
    }}
  />
</CodeDiffList>;
```

`CodeDiff` also takes `overflow`. `wrap` (default, as before) breaks long lines, which suits prose. `scroll` keeps each line on one row behind a horizontal scroll, which suits source code; in the split layout each side scrolls on its own.

Added `DiffStat`, the green `+N` and red `−N` line counts of a change. It takes the surrounding text style, and screen readers hear "4 additions and 1 deletion" instead of the symbols.
