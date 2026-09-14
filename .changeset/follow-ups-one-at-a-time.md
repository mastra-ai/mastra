---
'@mastra/core': patch
---

Fixed several queued messages being sent together instead of one at a time. A message sent while a run was still starting was folded into that run's first request; it now waits in the follow-up queue. Steer no longer drops the queue: it stops the current run, or a run parked on a tool suspension, sends its message next, and the queued follow-ups run after it, one at a time. After Stop on a parked run the queue moves on, and a message whose send never became a run no longer holds the queue.
