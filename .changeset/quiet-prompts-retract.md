---
'@mastra/core': patch
---

Fixed AgentController sessions that kept showing a tool prompt that could no longer be answered. When the agent no longer holds a suspended call by the time you answer it, for example because another runtime already resumed it, the session now retracts the prompt with `tool_suspension_cancelled` instead of showing it again. Other prompts on that run that the agent no longer holds are retracted too. Prompts the agent still holds, and prompts on other runs, stay open.
