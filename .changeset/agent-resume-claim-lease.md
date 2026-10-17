---
'@mastra/core': patch
---

Fixed a plain `Agent` resume that could never be retried after its process died. When a process crashed or was redeployed while running `resumeGenerate()`, `resumeStream()`, `approveToolCall()` or `declineToolCall()`, every later resume of that run failed with `AGENT_RESUME_ALREADY_CLAIMED` (#27366).

A running resume now holds a lease that it renews while the run executes. On storage that supports run fencing (for example PostgreSQL and LibSQL), a later resume takes the run over once the lease expires: 15 seconds by default, set with `MASTRA_AGENT_THREAD_LEASE_TTL_MS`. Runs left stuck by earlier versions are recovered the same way. A resume whose lease is still live is still rejected, so concurrent resumes keep running the tool only once.

After a crash, the takeover runs the suspended tool again, so tools that run after approval should be idempotent.
