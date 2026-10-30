---
'@mastra/core': patch
---

Fixed lost signals when sending to a thread whose Redis lease is still held by a run that has already finished. The signal is now reported as delivered only after the lease holder confirms it was accepted. Otherwise Mastra retries taking the lease, or returns an explicit error instead of silently dropping the signal.
