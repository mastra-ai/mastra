---
'@mastra/evals': patch
---

Eval scorers now receive the original user message for runs started through the agent subscription / `sendMessage` API. Previously `getUserMessageFromRunInput` returned an empty value for these runs, so scorers could not see what the user said (only `agent.stream` and `agent.generate` worked).
