---
'@mastra/core': patch
---

Messages sent while an agent run is active are no longer silently lost when the run fails.

**Failed runs now finish cleanly.** A run that dies on a provider error previously never settled its completion watcher, so queued messages were never delivered, the thread stayed locked, and no error surfaced.

**Queued messages survive delivery failures.** If starting the follow-up run for a queued message fails, the message is put back at the head of the queue and the failure renders as an error. The message delivers on the next turn.
