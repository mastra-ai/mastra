---
'@mastra/memory': patch
---

Fixed observational memory returning success after partial buffered activation while the live unobserved message tail was still above the observation threshold. `runThresholdObservation()` now re-checks pending tokens after activation and continues with synchronous `observe()` when needed (#19767).
