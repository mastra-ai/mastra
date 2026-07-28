---
'@mastra/factory': patch
---

Fixed Factory provisioning a fresh Platform sandbox for every new session. Sandboxes from finished work items and deleted sessions are now scrubbed back to the repository's default branch and returned to a per-repository reuse pool, and new sessions for the same repository and user claim a pooled sandbox (recycling its workdir again on claim) instead of spinning up another VM.
