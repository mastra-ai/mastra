---
'@mastra/core': patch
---

Fixed a mode's `availableTools` being dropped after a tool approval. Approving or declining a tool call used to continue the run with every tool the agent has, including tools the mode excludes. The continuation now gets the same restricted tool set as the first model call.
