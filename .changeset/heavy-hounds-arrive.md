---
'@mastra/factory': patch
---

Fix skill kickoffs delivered into a terminating run being consumed without execution. The decision dispatcher now observes the run's end after a kickoff is delivered into an active run: if that run finishes without executing the kickoff, it is redelivered to wake the idle session, and if the run never ends before the observation deadline the pending start or decision is failed for retry instead of being silently completed.
