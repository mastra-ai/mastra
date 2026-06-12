---
'@mastra/core': patch
---

Add AGENT_RUN root span to DurableAgent.stream() and propagate tracingContext into workflow execution so durable agent runs produce observability traces
