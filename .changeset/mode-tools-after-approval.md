---
'@mastra/core': patch
---

Fixed a mode's `availableTools` being dropped after the run paused for the user. Approving or declining a tool call, answering `ask_user` or `request_access`, or rejecting a plan used to continue the run with every tool the agent has, including tools the mode excludes. The continuation now gets the same restricted tool set as the first model call.
