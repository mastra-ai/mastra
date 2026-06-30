---
'@mastra/deployer': minor
---

You can now define agents by file convention instead of registering each one in code: drop a directory under `src/mastra/agents/<name>/`, run a Mastra build/dev, and the agent is bundled and registered onto your Mastra instance automatically. A directory becomes an agent when it has a `config.ts` or `instructions.md`; `tools/*.ts` add tools, `skills/` add skills (a `createSkill()` module, a packaged `SKILL.md` with its `references/`, or a flat `<skill>.md`), and `subagents/<childId>/` (one level deep) add delegatable subagents. Each agent gets a default workspace unless `workspace.ts` / `config.workspace` overrides it, and files committed under `agents/<name>/workspace/` are mirrored into the bundle to seed that workspace at runtime. Projects with no file-based agents are unaffected — the original entry is used unchanged.

```text
src/mastra/agents/weather/
  config.ts          # export default agentConfig({ model: 'openai/gpt-4o' })
  instructions.md
  tools/get_weather.ts
  workspace/cities.json   # mirrored into the agent's workspace
```
