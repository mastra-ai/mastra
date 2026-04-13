---
'@mastra/ai-sdk': minor
---

Added agent versioning support to chat and network route handlers. You can now pass `agentVersion` to `chatRoute()`, `handleChatStream()`, `networkRoute()`, and `handleNetworkStream()` to target a specific agent version by ID or status (draft/published). Route handlers also accept `?versionId=<id>` or `?status=draft|published` query parameters at request time, which take precedence over static configuration. Requires the Editor to be configured.

```typescript
// Static version on route config
chatRoute({
  path: '/chat',
  agent: 'weatherAgent',
  agentVersion: { status: 'published' },
});

// Programmatic version on handler
const stream = await handleChatStream({
  mastra,
  agentId: 'weatherAgent',
  agentVersion: { versionId: 'ver_abc123' },
  params,
});
```
