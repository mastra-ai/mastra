---
'@mastra/core': minor
---

Added an `injectCatalog` option to `SkillsProcessor` so agents with many skills can leave the skills list out of the system message. With `injectCatalog: false`, the agent gets a short instruction to find skills with the `skill_search` tool and load them with the `skill` tool. The `skill`, `skill_read`, and `skill_search` tools stay available for both workspace skills and skills configured on the agent.

**Before**: every skill's name, description, and location was added to the system message on every request.

**After**:

```ts
import { Agent } from '@mastra/core/agent';
import { SkillsProcessor } from '@mastra/core/processors';

const agent = new Agent({
  workspace,
  inputProcessors: [new SkillsProcessor({ injectCatalog: false })],
});
```

Configure BM25 or vector search on the workspace when you turn the list off, since the agent finds skills only through `skill_search`. The option defaults to `true`, so existing agents are unchanged.
