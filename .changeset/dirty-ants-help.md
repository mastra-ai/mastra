---
'@mastra/core': patch
---

Fixed thread subscription streaming randomly stopping. The subscription generator now skips streams that are already locked by another consumer (e.g. during tool-call resumption), and follow-up messages within an active subscription use sendSignal directly to avoid a deadlock with waitForCurrentThreadStreamIdle.
