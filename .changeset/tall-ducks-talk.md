---
'@mastra/core': patch
---

Fixed built-in memory processors so canceled agent runs retain transcript history through normal output processing. Removed the accidental partial-abort persistence option because cancellation persistence is no longer opt-in.
