---
'@mastra/memory': minor
---

Added `skillResultFilter`, a ready-made `beforeObservation` hook that keeps Agent Skills results out of Observational Memory.

The built-in skill tools (`skill`, `skill_search`, `skill_read`) return a skill's instructions or file contents as their result. Without a filter, the Observer re-observes that text every time a skill is used. `skillResultFilter()` replaces those results with a placeholder before the Observer runs. The tool call is kept, so the Observer still records which skill was used and what it was called with.

```ts
import { Memory } from '@mastra/memory';
import { skillResultFilter } from '@mastra/memory/filters';

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

Pass `toolNames` to redact a different set of tools. Related to [#24152](https://github.com/mastra-ai/mastra/issues/24152).
