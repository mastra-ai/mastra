---
'@mastra/server': patch
---

Fixed session refresh probes so expected missing-session responses return clean JSON errors without logging handler stack traces.
