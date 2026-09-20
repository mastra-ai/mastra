---
'@mastra/core': minor
'@mastra/mcp-docs-server': patch
'@mastra/client-js': patch
'@mastra/factory': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/connect': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/code-sdk': patch
'mastracode': patch
'@mastra/mongodb': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/mysql': patch
'@mastra/turso': patch
'@mastra/pg': patch
---

**Added** `KnowledgeConfig.importers` now accepts an async resolver in addition to a static array. The runner resolves the callback at start and again at the top of each scheduling tick, so hosts can hand Knowledge a live list of importers driven by external state (for example, live Mastra Platform connections via `@mastra/connect`'s `importers()`). Definitions whose ids disappear stop being scheduled; new ids get registered; unchanged ids keep their registration and durable cursor state. Manual `registerImporter()` calls are never removed by resolver reconciliation, and resolver errors on a tick keep the previous set active.

```typescript
new Knowledge({
  storage,
  importers: async () => discoverImportersForThisProject(),
});
```
