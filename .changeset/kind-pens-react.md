---
'@mastra/core': patch
---

Fixed `add_reaction` and `remove_reaction` failing with "No channel context" on runs that did not start from a chat message, such as a schedule, a Studio prompt or a woken run. They now find the chat thread through the run's memory thread, the same way the agent's replies are posted.
