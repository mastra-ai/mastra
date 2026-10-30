---
'@mastra/pg': patch
---

Experiments and their results now keep the run times they were given. Result timestamps used to read back as the time the row was written, so durations showed as zero and experiment summaries disagreed with the individual results.
