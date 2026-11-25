---
'@mastra/platform': minor
---

Added `PlatformKnowledge.handleImporterRun(request)`, which runs one of the app's importer classes when Mastra Platform asks for it. Mount it at `POST /_mastra/knowledge-importers/run`:

```ts
registerApiRoute('/_mastra/knowledge-importers/run', {
  method: 'POST',
  requiresAuth: false,
  handler: c => knowledge.handleImporterRun(c.req.raw),
});
```

The request's run token is its only input. The handler claims the run from the Knowledge API, reads each credential from the environment variable Platform names, and runs the import in the background with core's runner, writing pages through the run's session. It answers `202` once the run starts, `401` without a run token, and `404` for another instance's run. It never follows redirects, so the run token only goes to the configured Knowledge API. Needs a `@mastra/core` with the Knowledge importer runner; on an older core it answers `501`.
