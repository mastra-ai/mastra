---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/client-js': patch
---

Add a passive, session-free thread listing for agent controllers. `AgentController.listResourceThreads({ resourceId })` (core), GET `/agent-controller/:controllerId/resources/:resourceId/threads` (server), and `client.getAgentController(id).listResourceThreads(resourceId, { limit, tags })` (client-js) list a resource's threads with live run state without getting-or-creating a server session, so observers like a sidebar activity poll never bring a cold session online.
