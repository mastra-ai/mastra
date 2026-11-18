---
'@mastra/core': patch
---

Fixed AgentController sessions that kept showing a tool prompt that could no longer be answered. When the agent no longer holds a suspended call by the time you answer it, for example because another runtime already resumed it, the session now retracts the prompt with `tool_suspension_cancelled` instead of showing it again. Other prompts on that run are retracted too when stored runs show the agent no longer holds them. If that lookup fails, they stay open. Prompts on other runs always stay open.
