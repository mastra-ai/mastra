---
'@mastra/core': patch
---

Fixed a queued message being lost when the run it was handed to on another process, or a run whose lease could not be handed over, finished at the same moment. The sending process now keeps the message until the owning run accepts it, and queues it again if that run ends first or its process stops holding the thread lease (checked every lease renewal interval, so after a crash the message runs about two intervals after the lease expires). Cancelling queued messages now also cancels a message that is waiting to be accepted, and the queue count includes it. If the owning run accepts the message but the notice of that is lost before the run ends, the message can run twice.
