---
'@mastra/factory': patch
---

Fixed Factory provisioning a fresh Platform sandbox for every new session. Sandboxes from finished work items and deleted sessions are now scrubbed back to the repository's default branch (including gitignored files) and returned to a per-repository reuse pool, and new sessions for the same repository claim a pooled sandbox (recycling its workdir again on claim) instead of spinning up another VM. GitHub tokens are no longer baked into the sandbox VM's environment at provision time — they are injected per command only — so a reused VM never carries a previous session's credentials.
