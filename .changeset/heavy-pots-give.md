---
'@mastra/memory': patch
---

Added persistent reminder conversations and asynchronous `ask_memory` questions with correlated partial and terminal replies. The tool returns immediately with a reply ID and pending status, then delivers answers later as correlated signals.

Enable the experimental reminder sidekick on observational memory:

```ts
import { Memory, Subconscious } from '@mastra/memory';

const memory = new Memory({
  options: {
    observationalMemory: {
      model: 'openai/gpt-5-mini',
      experimental_subconscious: new Subconscious({ observation: ['remind'] }),
    },
  },
});
```
