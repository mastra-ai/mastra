---
'@mastra/factory': patch
---

Added Factory API support for automation clients to inspect and operate projects, work items, decisions, attention, health, metrics, and supervisor state.

```ts
import { MastraFactory, type MastraFactoryConfig } from '@mastra/factory';

export function createFactory(storage: MastraFactoryConfig['storage']) {
  return new MastraFactory({ storage });
}
```
