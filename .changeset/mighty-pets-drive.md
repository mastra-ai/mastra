---
'@mastra/core': patch
'@mastra/convex': patch
---

Fixed evented workflows ending a run twice when two `foreach` iterations failed at the same time. The run now fails once, with the first failure's error, and a result saved after the failure no longer marks the step as running again.
