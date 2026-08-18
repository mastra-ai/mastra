---
'@mastra/evals': patch
---

Fixed LLM-judge scorers scoring an intermediate reply instead of the agent's final answer. When agent output contains multiple assistant messages (multi-step runs), scorers such as Prompt Alignment now evaluate the last assistant response that contains text. Fixes #21645
