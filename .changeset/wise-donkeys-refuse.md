---
'@mastra/core': patch
---

Fixed the default workflow execution engine serializing the full RequestContext on every step and entry and then discarding the result. `serializeRequestContext` probes every stored value with `JSON.stringify` via `RequestContext.toJSON()`, but on the default engine the serialized object was never read — only engines with `requiresDurableContextSerialization()` (e.g. Inngest) restore context from serialized results. The step/entry return paths now skip serialization on the default engine; snapshot persistence is unaffected.
