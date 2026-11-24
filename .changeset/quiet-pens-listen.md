---
'@mastra/server': minor
'@mastra/editor': minor
'@mastra/client-js': minor
---

Added version tags for stored prompt blocks. A tag is a name, such as `production`, that points at one version of a prompt block, the same way version tags work for stored agents.

Tags live in the prompt block's `metadata.versionTags` (tag name to version ID) and are set with the existing prompt block update route. No new routes or tables are added.

```bash
# Tag a version
curl -X PATCH http://localhost:4111/api/stored/prompt-blocks/tone-of-voice \
  -H "Content-Type: application/json" \
  -d '{ "metadata": { "versionTags": { "production": "<versionId>" } } }'

# Read the tagged version
curl http://localhost:4111/api/stored/prompt-blocks/tone-of-voice?tag=production

# Run an agent with the tagged version of every prompt block it references
curl -X POST http://localhost:4111/api/agents/support-agent/generate \
  -H "Content-Type: application/json" \
  -d '{ "messages": "hi", "requestContext": { "promptVersionTag": "production" } }'
```

In the Client SDK, pass the tag to `details()`:

```typescript
const prompt = await mastraClient.getStoredPromptBlock('tone-of-voice').details(undefined, { tag: 'production' });
```

A referenced prompt block that doesn't have the requested tag renders its published version. A tagged version can't be deleted and is kept when old versions are pruned.
