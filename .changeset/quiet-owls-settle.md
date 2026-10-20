---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed several ways a suspended agent run could be resumed twice, never, or after it was aborted.

- **Approving after abort:** approving, declining, or resuming a run after `abortRunStream()` / `abortThreadStream()` hit its suspension now fails with `AGENT_RESUME_ABORTED_RUN` instead of running the tool or starting another model request. Fixes #27617.
- **`listSuspendedRuns()` after resume:** `DurableAgent` now marks a resumed run as running as soon as it resumes, so it drops out of `listSuspendedRuns()` right away, including in other processes. A second resume of the same run fails with `AGENT_RESUME_ALREADY_CLAIMED` instead of running twice. Fixes #27619.
- **Resumer process dies:** a running resume keeps renewing its claim. If the process dies, a later resume or approval fails with `AGENT_RESUME_ALREADY_CLAIMED` until the claim lapses, then takes the run over (or fails with `AGENT_RESUME_RUN_FINISHED` when recovery already completed it). Fixes #27366.
