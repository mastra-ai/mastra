---
'@mastra/factory': minor
---

Added `workBoard` and `WorkBoardPhase` exports so developers can inspect the built-in Work board phases and validate lifecycle transitions.

```ts
import { workBoard } from '@mastra/factory';

workBoard.allowsTransition('planning', 'execute');
```
