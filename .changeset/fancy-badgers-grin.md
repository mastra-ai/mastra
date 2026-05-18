---
'@mastra/libsql': patch
---

Fixed Harness channel inbox updates in LibSQL so stale workers cannot overwrite newer state while same-claim lease renewals stay valid.
