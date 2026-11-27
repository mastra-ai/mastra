---
'@mastra/factory': minor
---

Added `createWorkflowBoardEngine`, a board engine that runs each card on a `factory-board` workflow run of its own. Pass it as `boardEngine` and every move and run end for a card goes through that card's run, one at a time; moves still commit with every board check. `MastraFactory` registers the workflow with your Mastra, and a custom engine can list its own workflows under `workflows` to have them registered too.

```ts
import { MastraFactory, createWorkflowBoardEngine } from '@mastra/factory';

const factory = new MastraFactory({
  storage,
  boardEngine: createWorkflowBoardEngine,
});
```
