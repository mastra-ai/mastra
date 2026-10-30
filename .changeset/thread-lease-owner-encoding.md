---
'@mastra/core': minor
---

Thread lease owners now use a self-describing encoding, so generation-qualified owners and temporary handover (retake) tokens stay distinct from the run they belong to. Caller-provided run IDs are not restricted: any run ID round-trips through the lease owner unchanged, and remote liveness checks and waiters resolve a qualified owner back to its run instead of treating a busy thread as abandoned.

When upgrading a shared deployment, drain active thread runs and restart the API and worker processes together: older processes cannot decode the new qualified owner tokens.
