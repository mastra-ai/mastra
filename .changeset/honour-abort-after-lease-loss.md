---
'@mastra/core': patch
---

Stop an agent run as soon as another replica asks to abort it, even after the run has lost its thread lease. Previously the abort request was ignored once the lease was gone, so the run kept calling tools until its own lease renewal noticed the loss.
