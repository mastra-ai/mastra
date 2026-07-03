---
'mastra': patch
---

Fixed a crash in `mastra dev` peer dependency checks when locally linked Mastra packages declare `workspace:` version ranges. These ranges are now skipped instead of failing with "Invalid comparator: workspace:^".
