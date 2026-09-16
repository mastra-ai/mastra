---
'@mastra/react': patch
---

Fixed workflow streams from an earlier run overwriting the active run or clearing its loading state. Cancel obsolete streams, preserve sparse stored step data, and represent partial workflow results accurately in React types.
