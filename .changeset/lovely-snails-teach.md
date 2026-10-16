---
'@mastra/client-js': major
---

Removed `agent.network()`, `approveNetworkToolCall()` and `declineNetworkToolCall()`, and the `networkId` option on `listThreadMessages()` and `deleteThread()`. Use `agent.stream()` on a supervisor agent and pass `agentId`.
