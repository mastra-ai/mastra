---
'@mastra/memory': patch
---

Detect long-period multi-line repetition loops in observer/reflector output. The existing degenerate-output check sampled fixed-size windows, which has an aliasing blind spot: a repeating block whose period doesn't align with the sampling stride produces zero duplicate windows even when it dominates the output. Production records showed observer outputs where a 21-line block repeated 62 times (and an 8-line block repeated 140 times) passed the check and inflated observational memory to 2-3x the reflection threshold, causing constant synchronous reflection churn. Observations are line-oriented, so the detector now also flags output where more than half of the substantial lines are exact duplicates.
