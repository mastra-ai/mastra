---
'@mastra/core': patch
---

Fixed a message sent from an `AgentController` session being dropped when another agent was mid-run on the session's thread. The message now waits for that run to end and then runs. Pressing Stop while it waits drops it. If that run is waiting for an answer to its own prompt, the message isn't sent and the session shows an error saying so. A message sent while the thread is still held by a waiting run that was dropped from memory now waits for that hold to expire, then runs. Signals sent straight to the agent still report the thread as blocked.
