---
'@mastra/server': minor
'@mastra/editor': minor
---

A version tag now selects the whole run. Calling an agent with `agentVersionTag` also runs the tagged version of each sub-agent and renders the tagged version of each prompt block the agents reference. A sub-agent or prompt block without the tag uses its published version.

```bash
# One tag pins the agent, its sub-agents and their prompt blocks
curl -X POST http://localhost:4111/api/agents/support-agent/generate \
  -H "Content-Type: application/json" \
  -d '{ "messages": "hi", "requestContext": { "agentVersionTag": "production" } }'
```

Send `promptVersionTag` as well to select prompt blocks with a different tag. A sub-agent version set in the request's `versions` still wins over the tag.

A `promptVersionTag` that none of the run's prompt blocks have now returns a `404` response instead of running on published prompts, so a mistyped tag is caught. A tag that only some of the prompt blocks have still runs.
