---
'@mastra/core': patch
---

Fix observability log correlation: every log emitted from inside an agent run was landing in storage with `entityId`, `runId`, `traceId`, and other correlation fields set to `null`.

Root cause: #15072 split `getCurrentSpan` into `observability/context-storage.ts` and made `DualLogger` look it up via a resolver slot in `observability/utils.ts`. The resolver was registered as a side effect of importing `context-storage.ts`, but nothing in production code actually imported it — so `resolveCurrentSpan()` always returned `undefined`, `DualLogger` always fell back to the global uncorrelated `loggerVNext`, and `buildLogRecord` wrote `null` for every correlation column.

Fix: add a side-effect import of `../observability/context-storage` in the server-only `Mastra` class so the AsyncLocalStorage resolver is registered before any agent runs. Browser bundles are unaffected because `Mastra` is server-only.
