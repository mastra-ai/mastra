---
'@mastra/core': patch
---

Fixed a message sent from an `AgentController` session being dropped when another agent was mid-run on the session's thread. The message now waits for that run to end and then runs. Pressing Stop while it waits drops it. Signals sent straight to the agent still report the thread as blocked.
