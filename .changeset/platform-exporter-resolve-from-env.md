---
'@mastra/observability': patch
---

Added a `resolveFromEnv` option to `MastraPlatformExporter`. Set it to `false` when embedding Mastra in another tool so credentials come only from the config you pass and `MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_CLOUD_ACCESS_TOKEN` and `MASTRA_PROJECT_ID` in the environment are ignored. The default (`true`) keeps the existing behavior.

```ts
new MastraPlatformExporter({
  accessToken: myToken,
  projectId: 'proj_123',
  resolveFromEnv: false,
});
```
