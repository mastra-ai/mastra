---
'@mastra/playground-ui': patch
---

CollapsiblePanel now accepts an external `panelRef` so callers can collapse or expand the panel programmatically. Expanding a collapsed panel restores the exact width it had before collapsing, and falls back to `defaultSize` after a reload instead of opening at `minSize`. Removed the cursor-following pill on collapsed panel edges.
