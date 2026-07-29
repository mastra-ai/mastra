---
'@internal/core': patch
'@mastra/core': patch
---

Fixed `RequestContext.toJSON()` blocking the event loop when a stored value is an acyclic object graph with layered shared references. `JSON.stringify` expands shared references once per path, so a graph of ~30 heap objects with two-way sharing expands to 2^30 visited nodes: the serializability probe would burn 60-100 seconds of synchronous CPU, throw `RangeError` past V8's string-length cap, and silently filter the key anyway. The probe is now budgeted at 1M visited nodes — values that expand past the budget are filtered immediately, in milliseconds, with the same outcome. Handling of circular references, cross-context cycles, functions, and symbols is unchanged.
