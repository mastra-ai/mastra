---
'@mastra/platform': minor
---

Added project instance discovery to `PlatformKnowledge`: without `instanceId`, it finds your project's Knowledge instance on first use, from a project token or `projectId`/`MASTRA_PROJECT_ID`.

```ts
// Before
new PlatformKnowledge({ instanceId: 'kn_123', tools: true });
// After
new PlatformKnowledge({ tools: true });
```

Its default `id` is now `platform-knowledge` (was random per boot) and its storage id is `platform-knowledge` (was `platform-knowledge-<instanceId>`). If you register more than one `PlatformKnowledge`, give each its own `id` and its own Knowledge instance.
