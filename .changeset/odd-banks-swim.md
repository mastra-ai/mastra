---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added a draft-first save and unpublish flow for stored agents.

**Save without publishing**: pass `publishOnSave: false` when creating or updating a stored agent to keep the new version a draft until you explicitly publish it with `activateVersion()`.

**Unpublish**: the new `POST /stored/agents/:agentId/versions/unpublish` endpoint (and `unpublishVersion()` in the client SDK) clears the active published version. A code-defined agent falls back to its code configuration; saved versions remain available to restore.

```ts
const client = new MastraClient({ baseUrl: 'http://localhost:4111' });

// Save as draft instead of auto-publishing
await client.createStoredAgent({
  id: 'support-agent',
  name: 'Support',
  instructions: '...',
  model: 'openai/gpt-5.5',
  publishOnSave: false,
});

// Publish explicitly
await client.getStoredAgent('support-agent').activateVersion(versionId);

// Revert to the code-defined configuration
await client.getStoredAgent('support-agent').unpublishVersion();
```
