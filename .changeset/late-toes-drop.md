---
'@mastra/memory': patch
---

Fixed observational memory handing reflection a stale observation cursor when storage returns detached records. The reflection snapshot now carries the cursor this cycle just persisted, keeping reflection decisions and storage adapters that trust the passed record consistent with what was committed. Fixes #26483
