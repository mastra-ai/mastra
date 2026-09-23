---
'@mastra/core': patch
---

Fixed `runEvals` saving `mastra__authToken` and values that cannot be stored in score rows. Saved scores keep string, number and boolean request context values, and nested object values use dotted keys.
