---
'@mastra/server': minor
'@mastra/client-js': patch
'mastra': patch
---

Added version tags for stored agents. A tag is a name, such as `production`, that points at one version of an agent, so callers can select that version by name while newer versions are drafted and published.

Tags live in the agent's `metadata.versionTags` (tag name to version ID) and are set with the existing stored-agent update route. No new routes or tables are added.

```bash
# Tag a version
curl -X PATCH http://localhost:4111/api/stored/agents/support-agent \
  -H "Content-Type: application/json" \
  -d '{ "metadata": { "versionTags": { "production": "<versionId>" } } }'

# Read the tagged version
curl http://localhost:4111/api/agents/support-agent?tag=production

# Run the tagged version
curl -X POST http://localhost:4111/api/agents/support-agent/generate \
  -H "Content-Type: application/json" \
  -d '{ "messages": "hi", "requestContext": { "agentVersionTag": "production" } }'
```

A tagged version can't be deleted and is kept when old versions are pruned. `published` and `draft` are reserved tag names that select the matching status.
