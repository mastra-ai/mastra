---
'@mastra/core': patch
---

Fixed session messages starting while another agent runs on the same thread. When an `AgentController` uses an application's agent and has no `pubsub` of its own, its agents without their own `pubsub` now share the application's event bus. Session messages now wait for the other run to finish. A `pubsub` passed to the controller still takes precedence.
