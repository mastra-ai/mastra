---
'@mastra/server': patch
---

A2A tasks now fail with the processor's reason when an input processor aborts the run, instead of completing with an empty result. A2A file parts also keep their filename when converted for the agent.
