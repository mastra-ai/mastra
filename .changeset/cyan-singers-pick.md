---
'@mastra/factory': minor
---

Added board-owned transitionPolicy for custom transition restrictions. Work retains its classification, approval, and acceptance policy automatically. Custom boards no longer accidentally inherit Work policy through phase or role names; shared runtime safeguards remain enforced.

```typescript
const board = defineBoard({
  id: 'release',
  title: 'Release',
  initialPhase: 'approval',
  phases: {
    approval: { title: 'Approval', next: 'shipped' },
    shipped: { title: 'Shipped' },
  },
  transitionPolicy: context => {
    if (context.toStage === 'shipped' && !context.isHumanTransition) {
      return { type: 'reject', code: 'approval_required', reason: 'Human approval required.' };
    }
  },
});
```

Import defineBoard from @mastra/factory/boards and install the board through MastraFactory boards. Phase execution semantics and built-in customization are unchanged.
