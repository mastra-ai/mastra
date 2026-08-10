---
'@mastra/core': patch
---

Fix `deepEqual` returning `true` for values of mismatched shapes. A `Date` compared against a plain object (e.g. `deepEqual(new Date(), {})`) fell through to the generic object-key comparison — and since a `Date` has no own enumerable keys, it matched `{}`. Likewise an array compared against an object with matching index keys (e.g. `deepEqual([1, 2], { '0': 1, '1': 2 })`) returned `true`. Added guards so an array only equals an array and a `Date` only equals a `Date`; the checks apply recursively to nested values.
