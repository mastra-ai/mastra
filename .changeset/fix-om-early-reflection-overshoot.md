---
'@mastra/memory': patch
---

Fix observational memory early reflection activation overshoot. Idle-timeout (`activateAfterIdle`) and provider-change (`activateOnProviderChange`) triggers no longer activate a buffered reflection when the resulting active observations would be unhealthy. Two checks guard against overshoot:

- **Composition**: the unreflected observation tail must be at least as large as the buffered reflection itself (≥ 50/50 post-activation mix), preventing active observations from collapsing to mostly-compressed content.
- **Size**: the combined reflection + tail must be at least 75% of the regular threshold-activation target (`reflectThreshold × (1 − bufferActivation)`), preventing cliff cases where early activation drops active observations far below what a normal threshold activation would leave.

If either check fails, the buffered reflection is retained for the eventual threshold activation.
