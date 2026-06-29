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

Code-registered agents win on name collisions, and a `config.ts` that exports `new Agent()` is used as-is, so existing projects are unaffected.
