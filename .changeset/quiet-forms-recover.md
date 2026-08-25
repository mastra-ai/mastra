---
'@internal/playground': patch
---

Fixed a crash in the Studio form builder when a schema tree contained a node that was not a schema.

The Zod compatibility layer's intersection reader dereferenced the node before checking it, so a malformed entry took down the whole form instead of being skipped. Every other reader in that module already returned `undefined` in the same situation; now this one does too.

```ts
// Before: threw `Cannot read properties of undefined`
getIntersection(undefined);

// After: reports no intersection, like every other reader in the module
getIntersection(undefined); // => undefined
```
