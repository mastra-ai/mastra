---
'@mastra/core': patch
---

Fixed a channel typing status staying on the thread after a run ends. When a channel handler set a status before the run started (for example an early "is thinking..." in Slack) and the run's `typingStatus` function returned no status for any of its chunks, such as a run that only streamed hidden text, the status was never cleared. The status is now cleared at the end of every run whenever `typingStatus` is enabled.
