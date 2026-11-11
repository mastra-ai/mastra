---
'@mastra/core': patch
---

Fixed evented workflow runs running a step once per booting replica. `restart()` on an evented run now throws `WORKFLOW_RESTART_RUN_OWNED` while any instance is still running one of its steps, including steps of its nested workflows and the short gap between one step and the next, so booting instances leave live runs alone and retry once the run could be orphaned. Concurrent `restart()` calls on one run restart it once, and a step delivered twice runs on one instance at a time. A step whose instance crashed runs again once that instance's lease expires. Workflows with `autoRestartActiveRuns: false` are unchanged. Fixes #28712.
