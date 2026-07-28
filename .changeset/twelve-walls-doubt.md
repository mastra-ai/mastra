---
'@mastra/factory': patch
---

Fixed Factory provisioning a fresh Platform sandbox for every new session. Sandboxes from finished work items and deleted sessions now return to a per-repository reuse pool, and new sessions for the same repository and user claim a pooled sandbox (resetting it to the default branch) instead of spinning up another VM.
