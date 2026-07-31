---
'@mastra/core': minor
---

Made the file-based agent workspace opt-in so an agent directory no longer grants filesystem and shell tools by default.

Previously any agent under `src/mastra/agents/<name>/` silently received a workspace with file and shell tools, while the same agent written as `new Agent({ ... })` received none. Both now behave the same way: no workspace unless you ask for one.

**Opting in**

Set `workspace: true` in `config.ts` to get the managed local workspace:

```typescript
// src/mastra/agents/weather/config.ts
import { agentConfig } from '@mastra/core/agent';

export default agentConfig({
  model: 'openai/gpt-4o',
  workspace: true,
});
```

Adding a `workspace/` seed directory to the agent also opts in, and `workspace.ts` or `config.workspace` still take precedence.

**Upgrading**

If a file-based agent relied on the previous default, add `workspace: true` to its `config.ts`.
