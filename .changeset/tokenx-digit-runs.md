---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed token estimates for long numbers. Long digit runs (IDs, timestamps, numeric data) were counted as a single token, so Observational Memory and `TokenLimiterProcessor` underestimated number-heavy tool output and could miss their thresholds. Digit runs are now counted in chunks, closer to real tokenizers.
