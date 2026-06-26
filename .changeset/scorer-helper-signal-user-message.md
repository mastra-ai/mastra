---
'@mastra/evals': patch
---

Fixed `getUserMessageFromRunInput` returning an empty result for messages sent through the agent subscription / `sendMessage` API. Those messages are persisted with `role: 'signal'` and carry their user role on the signal metadata, so the user message is now extracted correctly for subscription-based scorer runs (previously only `agent.stream` and `agent.generate` worked).
