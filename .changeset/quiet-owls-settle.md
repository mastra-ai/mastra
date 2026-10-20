---
'@mastra/core': patch
---

Fixed `DurableAgent.listSuspendedRuns()` still listing a run after it was resumed, for example after approving a tool call, until the resumed run had fully cleaned up. A resumed run is now marked as running as soon as it resumes, so it drops out of `listSuspendedRuns()` right away, including from other processes. A second resume of the same run now fails with `AGENT_RESUME_ALREADY_CLAIMED` instead of running twice.
