---
'@mastra/pg': patch
---

Fixed caller-driven experiments failing with `null value in column "targetType" ... violates not-null constraint` on databases created before `targetType` and `targetId` became optional. The store now removes the old NOT NULL constraint from both columns at startup, so experiments without a target can be created again after upgrading.
