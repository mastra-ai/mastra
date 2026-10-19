---
'@mastra/core': patch
---

Fixed an `AgentController` with no `pubsub` of its own letting a session's run share a thread with another agent's run. The controller moved its agents onto its own internal Mastra, which put them on a separate event bus from the agents still on the application's Mastra, so neither saw the other's run on the thread. When an application's agent backs one of the controller's modes, all of the controller's agents now use that application's event bus, and a session message sent while another agent is mid-run waits for that run. A `pubsub` passed to the controller still takes precedence.
