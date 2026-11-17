---
'@mastra/factory': patch
---

Fixed a pull request getting two review verdicts on the same commit. A push during a running review queues another review; when the running review already covered the pushed commit, the queued one is now skipped. A review requested by a person after a verdict still runs.
