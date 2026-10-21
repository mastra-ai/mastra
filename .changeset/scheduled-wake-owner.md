---
'@mastra/code-sdk': patch
---

Scheduled prompts that fire into a session no longer held live in this process now run as that session's owner. Hosts that resume sessions (`resumeWakeSession`) bring the owner's session back first; if no owner can be found, the fire fails with `No session owns resource … to run its wake on thread …` before any run starts, instead of starting a run with no signed-in user that failed with "Tenant model credential policy could not be resolved: the request has no authenticated user." Only hosts with schedule tools enabled are affected.
