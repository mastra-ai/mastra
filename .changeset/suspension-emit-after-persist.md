---
'@mastra/core': patch
---

Publish tool suspension and approval events only after the parked tool call is saved to memory, so a client that reacts to the event — resuming it, or aborting the run — finds the tool call already persisted instead of racing the save still in flight. When memory is writable and that save fails, the suspension event is withheld and an error is sent on the stream instead, while the run still suspends so it can be resumed later; read-only memory, and runs without a save queue or thread, behave as before. An approval or error chunk that an output processor rejects is now delivered to the stream directly instead of only being logged, so clients still see that an approval is pending or why a suspension was not announced.
