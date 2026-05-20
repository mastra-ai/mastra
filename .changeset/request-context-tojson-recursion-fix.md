---
'@mastra/core': patch
---

Fixed infinite recursion in `RequestContext.toJSON()` when multiple
`RequestContext` instances reference each other through stored values.
Previously, serializing such cross-context cycles would cause a CPU hang.
Cyclic references are now detected and omitted from the serialized output,
consistent with how circular references within a single context are handled.
