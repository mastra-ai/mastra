---
'@mastra/pg': patch
'@mastra/core': patch
'@mastra/memory': patch
---

Improved recent-message reads so callers that only need the page can skip counting the whole thread. Agent history does this by default. Postgres peeks one extra row to keep pagination accurate.
