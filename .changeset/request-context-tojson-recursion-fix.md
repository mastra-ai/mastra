---
'@mastra/core': patch
---

Fixed `RequestContext.toJSON()` infinite recursion (100% CPU spin) that
occurred when two or more `RequestContext` instances were reachable from each
other's stored values. `isSerializable`'s `JSON.stringify(value)` probe
re-entered the second context's `toJSON()`, which re-entered the first,
through fresh V8 builtin frames — bypassing V8's per-call cycle detection
and blocking the event loop without overflowing the stack.

`toJSON()` now throws a private marker on cyclic re-entry that propagates up
through nested calls; the outermost `isSerializable` swallows it and filters
the offending key, consistent with how in-value circular references are
already filtered. No public API change.
