---
'@mastra/memory': patch
---

Fixed Observational Memory triggering Gemini Vertex thought signature validation errors when parallel tool calls were stored as separate assistant messages. Tool invocations now receive the last known thought signature so multi-step runs with thinking enabled complete successfully.
