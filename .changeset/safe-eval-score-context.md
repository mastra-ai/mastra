---
'@mastra/core': patch
---

Fixed `runEvals` saving the auth token and non-serializable request context values in score rows. Saved scores now use the same safe request context snapshot as live scoring: only string, number and boolean values are kept, nested objects are flattened to dotted keys, and `mastra__authToken` is never stored.
