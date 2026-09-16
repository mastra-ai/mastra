---
'@mastra/react': patch
---

Fixed workflow streams from an earlier run overwriting the active run or clearing its loading state. Cancel obsolete streams on reset and unmount, and report genuine transport errors without changing workflow result types or paused-run observation.
