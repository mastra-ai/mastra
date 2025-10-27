---
'@mastra/core': major
'@mastra/agent-builder': major
'@mastra/memory': major
'@mastra/evals': major
---

Remove various deprecated APIs from agent class.

- `agent.llm` → `agent.getLLM()`
- `agent.tools` → `agent.getTools()`
- `agent.instructions` → `agent.getInstructions()`
- `agent.speak()` → `agent.voice.speak()`
- `agent.getSpeakers()` → `agent.voice.getSpeakers()`
- `agent.listen` → `agent.voice.listen()`
- `agent.fetchMemory` → `(await agent.getMemory()).query()`
- `agent.toStep` → Add agent directly to the step, workflows handle the transformation
