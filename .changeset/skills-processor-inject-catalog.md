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

When you turn the list off, `skill_search` can find skills without additional search setup. For larger collections, configure BM25 or vector search on the workspace to improve ranking and retrieval. The instruction is left out when the `skill_search` tool isn't active for the request, or when the processor's own skills source discovered no skills. The option defaults to `true`, so existing agents are unchanged.
