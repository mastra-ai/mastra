---
'@mastra/memory': patch
---

Fixed a long agent run ending with a context-window error after observational memory had already recovered from one. Recovery now moves the rest of the run's response to a new message, so a later overflow in the same run can be observed and retried too.
