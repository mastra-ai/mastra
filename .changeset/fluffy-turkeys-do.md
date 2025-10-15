---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixes an issue where reasoning parts when retrieved from the DB inside uiMessages would be fragmented across many parts rather than consolidated in a single part which would make the UI look wrong.
