---
'@mastra/pg': patch
'@mastra/core': patch
---

Improved recent-message reads on Postgres so they can stop after the requested page instead of scanning the whole thread. Agent history skips the unused total; callers that still need a total get it in the same round-trip.
