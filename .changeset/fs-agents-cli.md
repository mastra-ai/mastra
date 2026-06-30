---
'mastra': minor
---

`mastra dev` and `mastra build` now pick up file-based agents defined under `src/mastra/agents/<name>/`. Agents created this way appear in Studio and respond just like agents registered in code, and the two styles can be mixed in one project. Files committed under `agents/<name>/workspace/` are mirrored into the agent's workspace so it starts with them on disk. Agents can also declare subagents under `agents/<name>/subagents/<childId>/`, which the agent can delegate to as a tool named after the directory.

```text
src/mastra/agents/weather/
  config.ts          # export default agentConfig({ model: 'openai/gpt-4o' })
  instructions.md
  tools/get_weather.ts
```

```bash
mastra dev   # discovers and registers src/mastra/agents/weather automatically
```
