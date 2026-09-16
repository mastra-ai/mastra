---
'@mastra/memory': minor
---

Added `skillResultFilter`, a ready-made `beforeObservation` hook that keeps Agent Skills results out of Observational Memory.

The built-in skill tools (`skill`, `skill_search`, `skill_read`) return a skill's instructions or file contents as their result. Without a filter, the Observer re-observes that text every time a skill is used. `skillResultFilter()` drops those results before the Observer runs and leaves the skill tool calls and every other message intact.

```ts
import { Memory } from '@mastra/memory';
import { skillResultFilter } from '@mastra/memory/processors';

const memory = new Memory({
  options: {
    observationalMemory: {
      model: 'google/gemini-2.5-flash',
      hooks: {
        beforeObservation: skillResultFilter(),
      },
    },
  },
});
```

Pass `toolNames` to filter a different set of tools. Related to [#24152](https://github.com/mastra-ai/mastra/issues/24152).
