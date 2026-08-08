---
'@mastra/core': patch
---

Fixed suspended runs that could fail to save after repeated tool calls.

A run's snapshot no longer grows with every step it took before suspending, which keeps agents that make many tool calls before their first approval prompt under MongoDB's 16 MB per-document limit — past it, the snapshot was never written and the resume reported the run as missing. Runs suspended by earlier versions still load.
