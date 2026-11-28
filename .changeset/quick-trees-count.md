---
'@mastra/memory': patch
---

Fixed Observational Memory cleanup blocking the event loop on long transcripts. Retention checks now track the remaining token count as messages are removed instead of re-counting the whole transcript for every removal, and the same messages are removed as before.
