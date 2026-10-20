---
'@mastra/code-sdk': patch
---

Fixed sandbox workspace search staying on the slow fallback for the whole session when its first search ran before the sandbox was ready. A failed search-tool check is now retried on the next search.
