---
'@mastra/server': minor
'@mastra/client-js': minor
---

Add a new `GET /agents/summary` endpoint and `client.listAgentsSummary()` SDK method that return a lean `{ id, name, description }` listing of agents.

Unlike `GET /agents`, the new endpoint never invokes any per-agent dynamic getter (instructions, llm, tools, default options, model list, sub-agents, workflows, processors, workspace, …), so it cannot fail when a user-supplied dynamic-config callback throws under the active `requestContext`. Use this endpoint when you only need a list of agent identities (e.g. populating a navigation list) and want a hard guarantee that the response shape is independent of the request context.

The existing `GET /agents` route and its response shape are unchanged.
