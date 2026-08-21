---
'@mastra/core': patch
---

Fixed agent memory so aborted and failed runs retain transcript history available when the run is saved. Removed the accidental partial-abort persistence option because this persistence is now mandatory.
