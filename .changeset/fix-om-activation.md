---
'@mastra/memory': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mongodb': patch
'mastracode': patch
---

Improve OM activation chunk selection to land closer to retention target

- Bias chunk selection "over" the target instead of "under", so post-activation context lands at or below the retention floor rather than above it
- Add overshoot safeguard: if bias-over would consume more than 95% of the retention floor, fall back to bias-under
- Add 1000-token floor: prevent bias-over from leaving fewer than 1000 raw tokens remaining
- Add `forceMaxActivation`: when pending tokens exceed `blockAfter`, bypass safeguards to aggressively reduce context
- Halve the async buffer interval when approaching the activation threshold for finer-grained chunks
- Allow `bufferActivation` to accept absolute token retention values (>= 1000) in addition to ratios (0-1)
