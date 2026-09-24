---
'@mastra/core': patch
---

Fixed a `foreach` over a nested workflow failing with "This suspended workflow run was already resumed by another caller" when one iteration suspended while others were still being started (concurrency greater than 1 but less than the number of items). Each iteration now starts its own nested run instead of trying to resume a sibling's suspended run.
