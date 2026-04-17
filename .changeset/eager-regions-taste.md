---
'@mastra/core': patch
---

Fixed Harness subagent tracing so delegated runs keep the parent tracing context and show up in the same trace in observability exporters. Fixes #15461.
