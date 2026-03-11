---
'@mastra/core': patch
---

Fixed processor-triggered aborts not appearing in traces. Processor spans now include abort details (reason, retry flag, metadata) and agent-level spans capture the same information when an abort short-circuits the agent run. This makes guardrail and processor aborts fully visible in tracing dashboards.
