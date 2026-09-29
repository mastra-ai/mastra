---
'@mastra/inngest': patch
---

Fixed `InngestAgent.resume()` accepting runs that had already finished. Resuming a completed run now fails with a "not suspended" error instead of running the previously suspended tool again, so a declined tool approval can no longer be approved after the run ends.
