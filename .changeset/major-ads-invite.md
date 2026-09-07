---
'@mastra/factory': patch
---

Added schema-backed Factory route contracts and deterministic CLI metadata generation for Factory API automation.

```ts
import { MastraFactory, type MastraFactoryConfig } from '@mastra/factory';

export function createFactory(storage: MastraFactoryConfig['storage']) {
  return new MastraFactory({ storage });
}
```
