---
'@mastra/core': minor
---

Added file-based agents: define an agent by file convention under `src/mastra/agents/<name>/` alongside agents created with `new Agent()`.

A directory becomes an agent when it has a `config.ts` or `instructions.md`. The directory name is the agent name. `instructions.md` supplies the instructions, `tools/*.ts` supply tools, and `skills/` supplies skills (a `createSkill()` module, a packaged `SKILL.md` directory, or a flat `<skill>.md`). Each file-based agent also gets a workspace by default (contained filesystem + shell sandbox rooted at a per-agent `workspace/` dir); customize it with a `workspace.ts` default export or `config.workspace`. Both styles register into the same Mastra instance and show up together in Studio, the server, and the bundler.

**Before**

```ts
import { Agent } from '@mastra/core/agent';

export const weather = new Agent({
  id: 'weather',
  name: 'weather',
  instructions: 'You are a weather assistant.',
  model: 'openai/gpt-4o',
});
```

**After (file-based, optional)**

```ts
// src/mastra/agents/weather/config.ts
import { agentConfig } from '@mastra/core/agent';

export default agentConfig({
  model: 'openai/gpt-4o',
  // instructions taken from instructions.md, tools from tools/*.ts
});
```

A file-based agent can also declare **subagents** under `agents/<name>/subagents/<childId>/`, using the same directory layout as an agent (`config.ts`, `instructions.md`, `tools/`, `skills/`, `workspace.ts` / `workspace/`). Each subagent is assembled independently and wired into the parent's `agents` map, so the loop exposes it as a delegation tool named after the directory. A subagent's `config.ts` must set a non-empty `description` (build error otherwise), subagents inherit nothing from the parent, and they are one level deep (a nested `subagents/` directory is ignored with a warning). A subagent id colliding with a parent tool key or another subagent id is a build error; an id also present in `config.agents` keeps the `config.agents` entry with a warning.

Code-registered agents win on name collisions, and a `config.ts` that exports `new Agent()` is used as-is (its sibling `instructions.md`, `tools/`, and `subagents/` are ignored with a warning), so existing projects are unaffected.

File-based agents are discovered by the bundler and are only registered when the app runs through the Mastra CLI (`mastra dev` / `mastra build`). If you import the `mastra` instance directly as a library (your own server, a server adapter, a framework route, or a test), the `agents/<name>/` directories are not discovered — register those agents in code instead.
