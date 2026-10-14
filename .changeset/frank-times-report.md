---
'@mastra/factory': patch
---

Fixed private sessions being reachable by teammates through the agent session routes. Streaming, sending messages, reading threads, changing state, and memory settings for a private session now return "not found" to anyone except the session owner.
