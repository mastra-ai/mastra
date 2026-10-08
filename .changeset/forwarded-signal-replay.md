---
'@mastra/core': patch
---

Fixed follow-up signals being silently dropped when the process that forwarded them to another thread owner later took over that thread. Previously, the retained signal was treated as the process's own echo and ignored. Signals the process queued locally are still deduplicated.
