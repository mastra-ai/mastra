---
"@mastra/core": patch
---

Fix duplicate OpenAI reasoning item (`rs_*`) on tool-approval resume caused by jsonb vs text key-order mismatch.

`CacheKeyGenerator.fromDBParts` used `JSON.stringify` to hash `data-*` parts, which is sensitive to object key order. PostgreSQL's `jsonb` column (workflow snapshot) normalizes key order, while the `text` column (messages) preserves insertion order. This caused functionally-equal messages to compare unequal, minting duplicate copies with the same `rs_*` reasoning id — which OpenAI rejects with `AI_APICallError: Duplicate item found`.

The fix replaces `JSON.stringify` with a stable, key-order-independent stringify so jsonb-reordered and text-preserved representations of the same message always produce the same cache key.

```typescript
// Before: { a: 1, b: 2 } and { b: 2, a: 1 } produced different cache keys
// After: both produce the same key regardless of key order
```
