---
'mastra': patch
---

Fixed the Agent Builder so newly created agents reliably get a real name, description, and instructions back-filled. Previously the builder could leave the truncated starter prompt as the agent's name, stall before writing instructions, or repeatedly call `set-agent-model` with empty payloads.
