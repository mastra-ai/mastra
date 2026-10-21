---
'@mastra/code-sdk': patch
'@mastra/core': patch
---

Fixed a notification sent from one Mastra Code process to a thread that another process on the same resource runs. The sending process woke the thread itself, without a session for it: the run failed with "No model available", or, when a session in the sender could resolve a model, ran the thread there with the sender's workspace and tools. The notification now waits for the process that runs the thread to deliver it, unless the sender routed it to the thread's claimed owner. `@mastra/core` now exports `readNotificationRoutingRequirement` so a delivery policy can tell whether a notification was routed that way.
