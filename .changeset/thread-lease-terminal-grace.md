---
'@mastra/core': patch
---

Fixed thread subscribers reporting "lost its lease before publishing a terminal event" for runs that had finished normally. A subscriber now waits one more lease interval after it first finds the thread lease free, so a finished run's last parts and completion event can still arrive. A run that really lost its owner is still reported, one interval later than before.
