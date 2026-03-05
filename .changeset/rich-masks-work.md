---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

- Fixed experiment pending count showing negative values when experiments are triggered from the Studio
- Fixed scorer prompt metadata (analysis context, generated prompts) being lost when saving experiment scores
