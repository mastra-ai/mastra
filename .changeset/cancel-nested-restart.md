---
'@mastra/core': patch
---

Fixed `run.cancel()` leaving nested workflow runs active after a process restart. Canceling a saved parent run now also cancels its saved child and grandchild workflow runs that are still running, suspended, waiting, or pending, on both the default and evented engines. Runs that already finished are left unchanged.
