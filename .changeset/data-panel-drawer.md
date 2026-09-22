---
'@mastra/playground-ui': patch
---

DataPanel now renders as a Base UI Drawer dialog: it slides in from the right, traps focus, and animates on open/close. It gains `size` (`md` | `half` | `wide` | `full`) and `depth` (1–3) props so sibling panels stack with the parent peeking out; `collapsed` is removed since drawers do not collapse. `TracesLayout` is removed — pages render panels directly as drawers.
