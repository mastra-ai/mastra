---
'@mastra/playground-ui': minor
---

Add `ManagedAgentSessionProvider` at `@mastra/playground-ui/domains/factory/session/thread`. It backs the Factory `SessionView` with an agent's memory threads instead of Agent Controller: the transcript comes from the thread subscription, sends and tool approvals go to the agent's thread routes, and the thread list comes from memory. Goal, permissions, thinking and model switching are left out, so the view hides them.
