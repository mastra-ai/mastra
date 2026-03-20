---
'@mastra/core': patch
---

Fixed resuming suspended tool calls with `resumeStream` or `approveToolCall` failing with a TripWire when input processors (e.g. TokenLimiterProcessor) are enabled on the agent.
