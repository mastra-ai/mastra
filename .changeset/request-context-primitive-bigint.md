---
'@mastra/core': patch
---

Fixed `JSON.stringify(requestContext)` throwing `TypeError: Do not know how to serialize a BigInt` when a BigInt was stored directly in `RequestContext`. Such values are now left out of `toJSON()` output, matching how nested BigInts were already handled. BigInts are still included when `BigInt.prototype.toJSON` returns a JSON-serializable value, and `requestContext.get()` still returns the original value.
