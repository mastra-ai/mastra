---
'@mastra/factory': patch
---

Fixed Factory provisioning a fresh Platform sandbox for every new session. When a work item finishes or a session is deleted, its sandbox is scrubbed back to the repository's default branch (including gitignored files) and returned to a per-repository reuse pool, so new sessions for the same repository reuse a pooled sandbox instead of spinning up another VM.

GitHub tokens are injected per command and are no longer stored in the sandbox environment, so a reused sandbox never carries a previous session's credentials.
