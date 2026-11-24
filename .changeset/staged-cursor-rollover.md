---
'@mastra/pg': patch
'@mastra/libsql': patch
---

Fixed Observational Memory reflections dropping the observation cursor saved with the current record, which made a restarted thread reload messages it had already observed.
