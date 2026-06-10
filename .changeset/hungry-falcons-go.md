---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/server': patch
---

**Added** optional `getUsers(userIds)` batch lookup method to `IUserProvider`. Auth providers can implement it to resolve multiple users in a single call; providers that don't implement it continue to work via per-id `getUser` fallback.

```ts
// optional batch lookup, returns results positionally aligned to userIds
const users = await provider.getUsers?.(['u_1', 'u_2', 'u_3']);
```
