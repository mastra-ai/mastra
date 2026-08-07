---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed custom provider models saved with a stray `mastracode/` prefix in settings, which broke selecting and using them after choosing them from `/models` (#20799)
