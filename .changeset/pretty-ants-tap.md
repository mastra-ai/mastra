---
'@mastra/factory': minor
---

Added a typed board definition API and migrated the built-in Review board to declare its phases, transitions, and phase behavior through it. This establishes the contract for future custom board installation and Mastra Workflow integration.

```ts
import { defineBoard } from '@mastra/factory';

const board = defineBoard({
  id: 'release',
  title: 'Release',
  initialPhase: 'prepare',
  phases: {
    prepare: { title: 'Prepare', next: 'verify' },
    verify: { title: 'Verify', outcomes: { approved: 'done', rejected: 'prepare' } },
    done: { title: 'Done' },
  },
});
```
