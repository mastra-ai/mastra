---
'@mastra/core': patch
---

Hardened `runEvals` threshold checks: non-finite scores (for example `NaN`) now fail `min`/`max` range thresholds instead of passing, and invalid threshold shapes passed from JavaScript (strings, `null`, arrays) are rejected with a clear `INVALID_SCORER_THRESHOLD` error instead of silently passing every score.
