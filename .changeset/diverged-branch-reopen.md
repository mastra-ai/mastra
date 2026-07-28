---
'@mastra/factory': patch
---

Reopening a workspace no longer fails with "git pull failed: Not possible to fast-forward" when the sandbox workdir was left on a session branch that diverged from its upstream (or has no upstream / detached HEAD). That state is the session's local work, so materialization now keeps the checkout as-is and continues instead of erroring the thread page; genuine pull failures (auth, egress, corruption) still surface.
