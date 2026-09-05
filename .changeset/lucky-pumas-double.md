---
'@mastra/redis': patch
---

`increment` and `listPush` now refresh the key TTL inside a single Lua EVAL round trip instead of a follow-up `EXPIRE` command, cutting the per-publish cache round trips behind `CachingPubSub` from four to two. Clients without classic EVAL (e.g. Upstash REST via `upstashPreset`) keep the previous sequential behavior. (#22477)
