---
'@mastra/factory': minor
---

Added the built-in Work board definition so its phases and phase behavior use the typed board lifecycle API alongside the Review board.

```ts
import { workBoard } from '@mastra/factory';

workBoard.allowsTransition('planning', 'execute');
```
