---
'@mastra/core': patch
---

Fixed evented workflows to recover sleeps after a process restart by replaying the sleeping path without rerunning completed steps.
