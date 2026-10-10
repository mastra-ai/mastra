---
'@mastra/core': patch
---

Faster startup when restarting active workflow runs. Mastra no longer scans storage for workflows that set `autoRestartActiveRuns: false`. It also skips the internal workflows that run agent processors, since those only run during an agent call.
