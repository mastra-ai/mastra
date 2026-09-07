---
'@mastra/factory': patch
---

Added schema-backed Factory route contracts, deterministic CLI metadata generation, and validated organization selection for authenticated automation clients.

```ts
import { MastraFactory, type MastraFactoryConfig } from '@mastra/factory';

export function createFactory(storage: MastraFactoryConfig['storage']) {
  return new MastraFactory({ storage });
}
```
