---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed Mastra Code switching back to Plan mode after a goal started from an approved plan (Use as /goal) was marked done. It now stays in Build mode so you can keep working; use /mode to switch back to Plan mode when you want to plan again. Fixes #26108.
