---
'@mastra/inngest': patch
'@mastra/core': patch
---

Fixed Inngest workflow traces being split when a sampler is set. Step spans and nested workflow runs now follow their run's sampling decision, so a run is recorded whole or not at all.
