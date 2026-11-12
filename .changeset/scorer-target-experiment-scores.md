---
'@mastra/core': patch
---

Fix experiments whose target is a scorer (or processor) silently discarding their scores. Those targets emit `entityType` as `SCORER` / `PROCESSOR`, which `scoringEntityTypeSchema` did not accept, so `validateAndSaveScore` threw Zod validation errors that were swallowed as best-effort warnings and the scores never reached storage. The schema now accepts both values.
