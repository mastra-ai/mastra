---
'@mastra/core': patch
---

Fixed `untilIdle` streams answering twice when a background tool's result already reached the model. This happened with an awaited background tool, and with a deferred task that finished while the run was still going. Tasks whose result the model hasn't seen yet still get their follow-up turn.
