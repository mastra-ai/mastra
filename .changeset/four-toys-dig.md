---
'@mastra/core': minor
---

Added SkillSearchProcessor for on-demand skill discovery. Instead of injecting all skill metadata upfront, agents get `search_skills` and `load_skill` meta-tools to find and load skills on demand with thread-scoped state and TTL cleanup.

**Example**

```typescript
import { SkillSearchProcessor } from '@mastra/core/processors';

const skillSearch = new SkillSearchProcessor({
  workspace,
  search: { topK: 5 },
});

const agent = new Agent({
  workspace,
  inputProcessors: [skillSearch],
});
```
