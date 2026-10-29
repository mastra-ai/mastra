---
'@mastra/core': patch
---

Tool suspensions and approval requests are now published to the stream only after the parked tool call is saved to memory. A client that reacts to the suspension event — resuming it, or aborting the run — now always finds the tool call already persisted instead of racing the save still in flight. If that save fails, the suspension event is withheld and the run suspends silently, so no client is sent looking for a tool call that memory never received.
