---
'@mastra/core': patch
---

Forward the workflow’s writable stream into the resume execution path so resumed steps still have a writer and continue emitting workflow-step-output chunks.
