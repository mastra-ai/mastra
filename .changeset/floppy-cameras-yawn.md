---
'@mastra/core': patch
---

Resumed evented runs that finish on another worker now score against the resumed run's span. A run the sampler declined stays unscored, and a sampled one keeps its score linked to the right trace.
