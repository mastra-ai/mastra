---
'@mastra/core': patch
---

Fixed AgentController skipping tool approval for the rest of a turn after the user answered an `ask_user` or `request_access` prompt. The answer still reaches the paused tool, and any tool the model calls afterward waits for approval as usual.
