---
'@mastra/core': minor
---

Added bounded nested string, number, and boolean metadata predicates to trace queries. Use dot notation for ordinary paths and a segment array only when a stored key contains a literal dot:

```ts
const nestedPredicate = {
  op: 'gte',
  left: { path: 'metadata.retry.count' },
  right: { literal: 3 },
}
const exactKeyPredicate = {
  op: 'eq',
  left: { path: ['metadata', 'customer.id'] },
  right: { literal: 'literal-key' },
}
```

Discovery now returns recursively observed metadata fields with typed values and type-specific operators. Arrays aren't traversed, scalar types aren't coerced, and malformed paths are rejected before storage runs.

**Breaking change**

Metadata strings now compare exactly. Stored empty and whitespace-only strings are present values instead of missing values, and leading or trailing whitespace is no longer trimmed.

```ts
// Before: matched a stored value of '  active  '.
const previousPredicate = {
  op: 'eq',
  left: { path: 'metadata.status' },
  right: { literal: 'active' },
}

// Now: match the stored value exactly.
const exactPredicate = {
  op: 'eq',
  left: { path: 'metadata.status' },
  right: { literal: '  active  ' },
}
```
