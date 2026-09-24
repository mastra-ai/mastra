---
'@mastra/factory': patch
---

Keep integration arrivals in Intake until someone starts them.

Before: trusted issue and pull request arrivals could create triage or review proposals, and unbound Linear, Jira, and incident.io cards landed in Triage. After: all arrivals wait in Intake without starting a run. To restore automatic triage, configure a custom board's initial-phase handler:

```typescript
import { MastraFactory } from '@mastra/factory';
import type { MastraFactoryConfig } from '@mastra/factory';
import { defineBoard } from '@mastra/factory/boards';

const customWorkBoard = defineBoard({
  id: 'custom-work',
  title: 'Custom Work',
  initialPhase: 'intake',
  phases: {
    intake: {
      title: 'Intake',
      kind: 'resting',
      onEnter: {
        issue: context =>
          context.cause === 'linked_item_materialized' && context.item.metadata?.autoStartCandidate === true
            ? {
                type: 'invokeSkill',
                idempotencyKey: `${context.ingress.id}:factory-triage`,
                role: 'triage',
                skillName: 'factory-triage',
              }
            : undefined,
      },
    },
    triage: { title: 'Triage', kind: 'working', role: 'triage' },
  },
});

export function createFactory(storage: MastraFactoryConfig['storage']) {
  return new MastraFactory({ storage, boards: [customWorkBoard] });
}
```
