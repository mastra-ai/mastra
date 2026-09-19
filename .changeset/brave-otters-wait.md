---
'@mastra/core': patch
---

Fixed duplicate work when a PubSub backend redelivered an idle signal to a claimed thread owner. A redelivered signal is now ignored instead of queueing the signal again or starting a second run for the same run id.
