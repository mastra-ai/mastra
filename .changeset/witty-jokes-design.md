---
'@mastra/observability': minor
---

Added support for project-scoped CloudExporter collector routes for organization API keys.

**What changed**
CloudExporter now accepts a `projectId` option and reads `MASTRA_PROJECT_ID` so remote writes can target project-scoped collector URLs when you authenticate with an organization API key.

```ts
new CloudExporter({
  accessToken: process.env.MASTRA_CLOUD_ACCESS_TOKEN,
  projectId: process.env.MASTRA_PROJECT_ID,
});
```

When `projectId` is set, base endpoints resolve to `/projects/:projectId/ai/{signal}/publish`. Without it, existing JWT-style `/ai/{signal}/publish` routes still work as before.
