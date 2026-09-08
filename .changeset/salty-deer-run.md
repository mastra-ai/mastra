---
'@mastra/factory': minor
---

Added end-to-end execution for installed custom boards. Lifecycle and tool-result decisions can target custom phases, linked items use the target board’s initial phase, and bound tools retain live authorization and revision checks.

Previously, installing a custom board did not enable decisions and tools to target its custom phases. Existing board configuration now runs through the shared Code Agent without a separate per-role agent API:

```typescript
import { MastraFactory } from '@mastra/factory';
import type { MastraFactoryConfig } from '@mastra/factory';
import { defineBoard } from '@mastra/factory/boards';
import type { BoardPhaseDefinition } from '@mastra/factory/boards';

type ReleasePhase = 'queued' | 'shipped';
const board = defineBoard<'release', Record<ReleasePhase, BoardPhaseDefinition<ReleasePhase>>>({
  id: 'release',
  title: 'Release',
  initialPhase: 'queued',
  phases: {
    queued: { title: 'Queued', kind: 'resting', next: 'shipped' },
    shipped: { title: 'Shipped', kind: 'terminal' },
  },
});

export function createFactory(config: MastraFactoryConfig) {
  return new MastraFactory({ ...config, boards: [board] });
}
```

Custom boards do not inherit Work policy. Built-in board customization, the built-in UI pipeline, and completion metrics are unchanged.
