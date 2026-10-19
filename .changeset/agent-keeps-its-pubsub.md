---
'@mastra/core': patch
---

Fixed an `AgentController` with no `pubsub` of its own letting a session's run share a thread with another agent's run. The controller moved its agents onto its own internal Mastra, which put them on a separate event bus from the agents still on the application's Mastra, so neither saw the other's run on the thread. An agent the controller moves onto its internal Mastra now keeps the event bus of the Mastra it came from, and a session message sent while another agent is mid-run waits for that run.
