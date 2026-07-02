---
'@mastra/core': patch
---

Fix evented workflow parallel steps re-running the wrong branch on restart. The parallel processor built each branch's execution path from its position in the filtered (active-only) list instead of its real index, so restarting a parallel step whose active branches were not a contiguous prefix routed to the wrong branch (and skipped the intended one). Branches are now addressed by their real index. Closes #18754.
