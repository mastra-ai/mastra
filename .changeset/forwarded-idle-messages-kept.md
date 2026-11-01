---
'@mastra/core': patch
---

Fixed a queued message being lost when the run it was handed to on another process, or a run whose lease could not be handed over, finished at the same moment. The sending process now keeps the message until the owning run accepts it, and queues it again if that run ends first.
