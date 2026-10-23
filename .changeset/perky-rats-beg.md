---
'@mastra/playground-ui': minor
---

`CodeDiff` can now carry a file header. Pass `header` with the file's `path` and it shows above the diff, with an optional `icon` before the path (the kind of change), your own `meta` (line counts) on the right, and a chevron that folds the diff away. `previousPath` adds a "from" line for renamed or moved files. With a header and no `patch`, the card shows the header alone, for files with no diff to show such as binaries or oversized changes.

Added `CodeDiffList`, a scroll container for many `CodeDiff`s. It stacks them edge to edge with a divider between files, the way a pull request does, and only renders the diff lines in view, so a change set with hundreds of files stays fast. Each file header stays pinned while you scroll through its diff.

```tsx
import { CodeDiff, CodeDiffList } from '@mastra/playground-ui/components/CodeDiff';

<CodeDiffList className="h-[640px]">
  <CodeDiff patch={agentPatch} header={{ path: 'src/agent.ts', meta: <span>+4 −1</span> }} />
  <CodeDiff
    header={{
      path: 'src/agents/helper.ts',
      previousPath: 'src/helper.ts',
      icon: <SquareArrowRight role="img" aria-label="Renamed" />,
    }}
  />
</CodeDiffList>;
```
