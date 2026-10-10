---
'@mastra/spanner': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
---

Fixed experiments without a target failing with a NOT NULL error on databases created before `targetType` and `targetId` became optional. The store now removes the old NOT NULL constraint from both columns at startup, so experiments without a target can be created again after upgrading.
