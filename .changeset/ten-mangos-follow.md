---
'@mastra/playground-ui': patch
---

Fixed Tooltip rendering so the arrow and popup edge align seamlessly on every side, removing the visible 1px seam previously visible at the bottom of left- and right-anchored tooltips. No public Tooltip API changes are required for existing consumers.
