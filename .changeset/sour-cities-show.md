---
'@mastra/core': patch
---

Fixed workflow `.sleep()` and `.sleepUntil()` waits longer than about 24.8 days ending almost immediately. The next step now runs only after the full wait, on the default and evented engines.
