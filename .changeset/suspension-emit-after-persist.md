---
'@mastra/core': patch
---

Publish tool suspension and approval events only after the parked tool call is saved to memory, so a client that reacts to the event — resuming it, or aborting the run — finds the tool call already persisted instead of racing the save still in flight. When memory is writable and that save fails, the suspension or approval event is withheld, the run remains suspended, and the stream attempts to report the save failure; read-only memory, and runs without a save queue or thread, behave as before. An approval or error chunk that an output processor rejects is now also written straight to the stream as a fallback, instead of only being logged.
