---
'@mastra/core': patch
---

Fixed an aborted tool approval being resumable from another server when the abort could not delete the suspended run's snapshot. Aborting a parked plain `Agent` run now marks the stored run `canceled` before dropping its snapshots, and a resume that finds that record fails with `AGENT_RESUME_ABORTED_RUN` instead of claiming the run and executing the suspended tool. The abort's own in-process fence is invisible to other servers, so previously a run whose snapshot cleanup failed stayed listed by `listSuspendedRuns()` and could be approved elsewhere.
