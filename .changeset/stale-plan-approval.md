---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed replies to stored tool questions after a server restart. Approving a plan or answering another tool question now picks the run up from storage instead of rejecting the reply as having nothing waiting on it.
