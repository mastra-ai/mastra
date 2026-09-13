---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed Knowledge node restoration leaving owned-record vectors permanently deleted: owner delete and restore now advance dependent record versions so every lifecycle cycle carries a fresh semantic-outbox idempotency identity. Governed scope restore and creation retry now read grants through a targeted `scopeNodeId` filter instead of scanning the whole grant graph.
