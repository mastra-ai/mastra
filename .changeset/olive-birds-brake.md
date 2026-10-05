---
'@mastra/core': patch
---

Reduced storage used by agent runs that recall conversation history from memory. Messages loaded from memory are now saved in workflow snapshots as references to the stored messages instead of full copies, and are loaded back from memory when the run continues. In a 12-step run that recalled 20 messages, persisted snapshot size dropped by about 25% for durable agents (on both the default and evented engines) and about 22% for agents waiting on tool approval.

If a recalled message is edited or deleted in memory while a run is suspended, the resumed run uses the stored version and drops deleted messages, logging a warning. Runs started on an earlier version still resume and finish normally. Runs started on this version can't be resumed after downgrading to an earlier `@mastra/core` version.
