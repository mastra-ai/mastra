---
'@mastra/inngest': patch
---

Fixed observability flush to run on all code paths, including when the finalize step throws an error. Previously, if the workflow failed inside step.run, the flush call was skipped because it was placed after the await.
