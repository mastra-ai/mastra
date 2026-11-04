---
'@mastra/core': patch
---

Fixed a queued message being lost when the run it was handed to, on this or another process, ended at the same moment. The message is now kept until that run accepts it and queued again if the run ends first. Cancelling queued messages also cancels a message that is waiting to be accepted, and the queue count includes it.
