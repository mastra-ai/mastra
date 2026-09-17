---
'@mastra/memory': minor
---

Added `skillResultRedactor`, a ready-made `beforeObservation` hook that keeps Agent Skills results out of Observational Memory.

The built-in skill tools (`skill`, `skill_search`, `skill_read`) return a skill's instructions or file contents as their result. Without redaction, the Observer re-observes that text every time a skill is used. `skillResultRedactor()` replaces those results with a placeholder before the Observer runs. The tool call is kept, so the Observer still records which skill was used and what it was called with.

```ts
import { Memory } from '@mastra/memory';
import { skillResultRedactor } from '@mastra/memory/hooks';

const memory = new Memory({
  options: {
    observationalMemory: {
      model: 'google/gemini-2.5-flash',
      hooks: {
        beforeObservation: skillResultRedactor(),
      },
    },
  },
});
```

Pass `toolNames` to redact a different set of tools. Related to [#24152](https://github.com/mastra-ai/mastra/issues/24152).
