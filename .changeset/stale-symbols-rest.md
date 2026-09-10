---
'@mastra/playground-ui': patch
---

CollapsiblePanel can now be controlled with `collapsed` / `onCollapsedChange`, so a parent can hide and show it from its own state. Expanding a collapsed panel restores the exact width it had before collapsing, and falls back to `defaultSize` after a reload instead of opening at `minSize`. Removed the cursor-following pill on collapsed panel edges.
