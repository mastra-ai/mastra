---
'@mastra/factory': minor
'@mastra/code-sdk': patch
---

Trigger Factory knowledge curation from observation volume, periodic active-run sweeps, and committed card-column transitions. Factory sessions now place curation in the observation lane at three uncurated records, while the Factory-owned worker and transition service use the same `Memory.runCuration` path for idle and lifecycle opportunities.
