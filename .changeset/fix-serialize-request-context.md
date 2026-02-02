---
'@mastra/core': patch
---

Fix RequestContext serialization to skip non-serializable values in all workflow paths

- `DefaultExecutionEngine.serializeRequestContext()` now uses `RequestContext.toJSON()`
- `EventedWorkflow.start()` and `startAsync()` now use `requestContext.toJSON()`
- `EventedExecutionEngine.execute()` now uses `requestContext.toJSON()`

All paths now properly filter out non-serializable values (functions, symbols, circular references, RPC proxies) when persisting workflow snapshots.
