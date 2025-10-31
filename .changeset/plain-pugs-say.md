---
'mastra': patch
---

Fix e2e test compatibility by passing version tags to all Mastra package installations. The `init` function now accepts an optional `versionTag` parameter that ensures all installed Mastra packages (`@mastra/evals`, `@mastra/libsql`, `@mastra/memory`, `@mastra/loggers`, `@mastra/observability`) use the same version, preventing module resolution errors when packages are updated with breaking internal changes.
