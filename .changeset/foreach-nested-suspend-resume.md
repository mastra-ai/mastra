---
'@mastra/core': patch
---

Fixed `foreach` over a nested workflow failing with "already resumed by another caller" when one iteration suspended while others were still starting. Each iteration now starts its own child workflow run, and suspended iterations can be resumed individually with `forEachIndex`.
