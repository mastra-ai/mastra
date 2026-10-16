---
'@mastra/server': major
---

Removed the agent network routes (`/agents/:agentId/network`, its approve/decline routes, and the `/memory/network/*` routes). Use the standard agent stream and memory routes with a supervisor agent.
