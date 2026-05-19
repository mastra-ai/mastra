---
'@mastra/memory': patch
---

Changed the default recall scope for Observational Memory from resource to thread. This prevents unintended data leakage between users when no explicit scope is configured.

**Before:** omitting `scope` defaulted to resource-scoped recall, exposing all threads under the same resource.

```ts
// previously leaked history across users
new Memory({ options: { observationalMemory: { retrieval: true } } });
```

**After:** omitting `scope` now defaults to thread-scoped recall. To preserve the previous behaviour, set `scope` explicitly.

```ts
// new default — safe, thread-isolated
new Memory({ options: { observationalMemory: { retrieval: true } } });

// opt in to resource scope explicitly if needed
new Memory({ options: { observationalMemory: { retrieval: { scope: 'resource' } } } });
```
