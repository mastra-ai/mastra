---
'@mastra/arize': patch
---

Fixed incorrect span kind mapping in @mastra/arize. Workflow spans now correctly map to CHAIN, agent spans to AGENT, and tool spans to TOOL instead of defaulting to LLM.
