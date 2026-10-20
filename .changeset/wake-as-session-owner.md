---
'@mastra/core': patch
'@mastra/code-sdk': patch
'@mastra/factory': patch
---

Fixed Factory sessions that could never be woken by a message once they were no longer open in the process delivering it. A deferred notification (for example from `factory_signal_session`) delivered after a restart, eviction, or on another replica ran with no user at all and failed every attempt with "Tenant model credential policy could not be resolved: the request has no authenticated user."

The wake now brings the session back online as its owner first, so it runs with the owner's credentials. A new optional `resumeWakeSession` option on `createMastraCode` lets a host do this. When the owner can't be resolved, the delivery fails with an error naming the reason, and the session's followers get a failed report. A notification delivery policy that throws now fails that delivery attempt instead of running a wake with no request context.
