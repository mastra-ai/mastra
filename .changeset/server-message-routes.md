---
'@mastra/server': minor
---

Add experimental HTTP message routes for agent threads. Servers now expose `POST /agents/:agentId/send-message` and `POST /agents/:agentId/queue-message` for message-first input while keeping `/agents/:agentId/signals` available for lower-level signals and compatibility.
