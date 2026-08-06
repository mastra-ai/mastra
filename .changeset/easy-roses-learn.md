---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/deployer': patch
'@mastra/core': patch
---

Added A2A protocol v1 support to the agent server with automatic version negotiation

A2A server endpoints now accept both v1 and v0.3 requests. The server reads the `A2A-Version` request header (defaulting to v1), accepts both v1 PascalCase method names (`SendMessage`, `GetTask`, …) and v0.3 slash-names (`message/send`, `tasks/get`, …), and serves a v1 agent card that is translated down to the v0.3 shape for older clients. A new `ListTasks` method (v1-only) returns an agent's tasks with pagination.

No changes are needed for existing v0.3 clients — they continue to work against the same `/a2a/:agentId` endpoint and `/.well-known/:agentId/agent-card.json`.
