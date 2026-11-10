---
'@mastra/core': patch
---

Fixed `untilIdle` streams answering twice when the model had already answered with a background tool's result. This happened with an awaited background tool and with a deferred task that finished while the run was still going. A task whose result the model hasn't answered yet still gets its follow-up turn.
