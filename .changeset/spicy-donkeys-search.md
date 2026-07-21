---
'@mastra/core': patch
---

Fix the `createDurableAgent` JSDoc examples to construct `RedisServerCache` with a connected Redis client (`{ client }`) instead of a `{ url }` config the class does not accept.
