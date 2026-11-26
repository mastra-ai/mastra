---
'@mastra/core': patch
---

Durable agents now offer the resuming caller's tools after a resume. When someone else approved or resumed a paused run (on the same server, on another server, or after crash recovery), later model steps could still be offered tools built for the user who started the run. Those steps now get the resuming caller's tools. Call-time `toolsets` from the starting call are kept when the resume doesn't pass its own.
