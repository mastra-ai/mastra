---
'@mastra/factory': minor
---

Added `@mastra/factory/contract`, a browser-safe entry with Factory's wire types and pure board helpers (default board, busy-card rule, intake order, card labels, people, change requests, source filters, audit actors). UIs can import it without pulling in storage, Node built-ins or the code SDK; a test fails if that ever changes.

```ts
import { phaseMayStartRun, cardChangeRequests } from '@mastra/factory/contract';
```
