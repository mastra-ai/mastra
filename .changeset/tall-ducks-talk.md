---
'@mastra/core': patch
---

Fixed agent memory so aborted and failed runs retain transcript history produced before termination. Removed the accidental partial-abort persistence option because this persistence is now mandatory.
