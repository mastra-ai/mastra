---
'@mastra/playground-ui': patch
---

Fix Crumb truncating labels without an ellipsis and clipping their descenders

`truncate` sat on Crumb's flex root, where `text-overflow` cannot apply — a
clamped label was hard-cut mid-glyph instead of ellipsized, and the accompanying
`overflow-hidden` sheared the descenders off the line box. Text children now get
their own truncating box while icons stay flex siblings.
