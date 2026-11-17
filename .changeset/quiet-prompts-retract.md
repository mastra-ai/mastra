---
'@mastra/core': patch
---

Fixed AgentController sessions that kept showing a tool prompt that could no longer be answered. When a suspended run is gone by the time you answer it, for example because another runtime already resumed it, the session now retracts every prompt parked on that run with `tool_suspension_cancelled`, instead of showing the prompt again. The next message starts a fresh run. Prompts parked on other runs are left open.
