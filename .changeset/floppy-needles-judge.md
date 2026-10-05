---
'@mastra/core': patch
---

Reduced storage used by agent runs waiting on tool approval or a suspended tool. Each suspended snapshot now stores the conversation one fewer time, cutting snapshot size by about 29% in a 12-approval run. Suspended runs resume exactly as before.
