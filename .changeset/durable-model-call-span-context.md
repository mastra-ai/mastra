---
'@mastra/core': patch
---

Fixed durable agents running the model call outside the model step span. Code that runs during the provider call, such as AI SDK model middleware or span-correlated logging, now gets the same current span from `getCurrentSpan()` on a durable agent as on a regular agent. Before this fix, metadata that middleware wrote to the current span landed on the workflow step instead of the model step.
