---
'@mastra/inngest': patch
---

Cancelling a run that has already finished no longer changes its status. Inngest durable agent runs that succeeded, failed, were cancelled, hit a tripwire, or bailed keep their final status when a late or retried cancel event arrives, while runs still in progress are cancelled as before. Fixes #31596
