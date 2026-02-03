---
'@mastra/observability': patch
---

Fix CloudFlare Workers deployment failure caused by `fileURLToPath` being called at module initialization time.

Moved `SNAPSHOTS_DIR` calculation from top-level module code into a lazy getter function. In CloudFlare Workers (V8 runtime), `import.meta.url` is `undefined` during worker startup, causing the previous code to throw. The snapshot functionality is only used for testing, so deferring initialization has no impact on normal operation.
