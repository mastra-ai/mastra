---
'@mastra/factory': patch
---

Fixed Factory sessions that couldn't be woken by a message (for example from `factory_signal_session`) once they were no longer open in the process delivering it. These wakes failed every attempt with "Tenant model credential policy could not be resolved: the request has no authenticated user." The session is now brought back online as its owner, so the wake runs with the owner's credentials. When the owner can't be resolved, the wake fails with the reason and the session's followers get a failed report with failure code `wake-owner-unresolved`.
