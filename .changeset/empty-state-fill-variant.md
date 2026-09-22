---
'@mastra/playground-ui': patch
---

Add a `variant="fill"` option to `EmptyState` that centers the block in the full height of its parent, replacing the `flex h-full items-center justify-center` wrapper every empty-state call site used to hand-roll.
