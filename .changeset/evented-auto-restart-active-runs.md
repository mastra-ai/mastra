---
'@mastra/core': patch
---

Fixed evented workflow runs, including scheduled workflows, staying `running` forever after a process restart. Set `options: { autoRestartActiveRuns: true }` on an evented workflow to have `mastra.restartAllActiveWorkflowRuns()` recover its in-flight runs on boot. The step that was running is executed again; completed steps are not. Evented workflows that don't opt in are unchanged. Fixes [#24984](https://github.com/mastra-ai/mastra/issues/24984).
