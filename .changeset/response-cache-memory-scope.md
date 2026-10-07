---
'@mastra/core': patch
---

Fixed `ResponseCache` sharing cached responses between users who are identified only through `memory: { resource }`. When no `scope` is set, the cache now falls back to the memory resource ID after the auth resource ID, so each user gets their own cache entries. Set `scope: null` to keep sharing responses across users.
