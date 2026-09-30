---
'@mastra/server': patch
---

A2A tasks now fail with the processor's reason when an input processor aborts the run, instead of completing with an empty result. File parts sent over A2A also keep their filename.
