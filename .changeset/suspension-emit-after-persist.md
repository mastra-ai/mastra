---
'@mastra/core': patch
---

Publish tool suspension and approval events only after the parked tool call is saved to memory, so a client that reacts to the event — resuming it, or aborting the run — finds the tool call already persisted instead of racing the save still in flight. When memory is writable and that save fails, the event is withheld and the run suspends quietly instead of announcing a parked call the store never received; read-only memory, and runs without a save queue or thread, behave as before.
