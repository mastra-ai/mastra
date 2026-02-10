---
'@mastra/core': patch
---

Fixed a crash when using agent workflows that have no input schema. Input now passes through on first invocation, so workflows run instead of failing. (#12739)
