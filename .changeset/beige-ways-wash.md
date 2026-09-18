---
'@mastra/core': minor
---

Improved runtime portability by using Web Crypto for IDs, hashes, and asynchronous cryptographic operations.

The exported `hashToUnitInterval`, `buildResponseCacheKey`, `ensureToolProperties`, and `computeScheduleDefinitionHash` helpers now return promises and must be awaited:

```ts
// Before
const key = buildResponseCacheKey(input);

// After
const key = await buildResponseCacheKey(input);
```
