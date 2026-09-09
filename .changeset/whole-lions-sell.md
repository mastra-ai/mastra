---
'@mastra/memory': patch
'@mastra/core': patch
'@mastra/pg': patch
---

Fixed PostgresStore counting the whole thread on every agent turn. Agent last-N memory reads (conversation history recall) no longer run a COUNT(*) over the entire thread when only the recent messages are needed. Instead the store fetches one extra row to determine whether more pages exist. Studio pagination is unchanged and still receives an accurate total.
