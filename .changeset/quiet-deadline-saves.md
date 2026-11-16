---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed a run that hit `modelSettings.timeout.totalMs` mid-reply on the Inngest engine saving only part of the turn. It now saves the turn the way the other durable engines do: the steps that finished in time are kept whole, the reply the deadline cut off is saved as its own message after the step processors have seen it, and a caller who may not write to the thread skips the save instead of failing.