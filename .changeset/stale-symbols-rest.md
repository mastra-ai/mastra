---
'@mastra/playground-ui': patch
---

CollapsiblePanel now exposes a `CollapsiblePanelHandle` (`collapse()` / `expand()`) through its `ref`, so a parent can hide and show it programmatically. Expanding restores the exact width the panel had when `collapse()` was called, and falls back to `defaultSize` after a reload instead of opening at `minSize`. Removed the cursor-following pill on collapsed panel edges.
