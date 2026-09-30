---
'@mastra/core': patch
---

Agent turns no longer write a workflow snapshot before the first model call, removing a storage round trip (about 300ms on remote stores) from every turn. Snapshots are still written when a run suspends, so tool approval, tool suspension, `resumeStream()`, and `resumeGenerate()` work as before, including when a resume or approval arrives before the suspend write finishes.
