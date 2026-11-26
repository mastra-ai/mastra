---
'@mastra/factory': minor
---

Added a `boardEngine` option to `MastraFactory`. Every stage move from people, chat, card creation, run starts, agent moves and review verdicts now goes through one board engine instead of calling the transition service directly. The default `createDispatcherBoardEngine` keeps today's behavior; pass your own factory to observe or replace how cards move.

```typescript
import { MastraFactory, createDispatcherBoardEngine } from '@mastra/factory';

const factory = new MastraFactory({
  storage,
  boardEngine: context => {
    const engine = createDispatcherBoardEngine(context);
    return {
      requestMove: request => {
        console.log('move', request.workItemId, request.stage);
        return engine.requestMove(request);
      },
      requestPlacement: placement => engine.requestPlacement(placement),
    };
  },
});
```
