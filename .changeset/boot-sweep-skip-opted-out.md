---
'@mastra/core': patch
---

`restartAllActiveWorkflowRuns()` no longer queries storage for workflows that set `autoRestartActiveRuns: false`, and no longer sweeps agent processor workflows (`<agentId>-input-processor` / `-output-processor`), which only run inside an agent call. This removes the boot-time snapshot scans reported in #25579.
