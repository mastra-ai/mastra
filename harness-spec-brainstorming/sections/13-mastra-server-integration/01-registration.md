### 13.1 Registration

```ts
import { Mastra } from '@mastra/core';
import { Harness } from '@mastra/core/harness/v1';

const codingHarness = new Harness(codingConfig);
const supportHarness = new Harness(supportConfig);

const mastra = new Mastra({
  agents: { /* ... */ },
  workflows: { /* ... */ },
  harness: {
    coding: codingHarness,
    support: supportHarness,
  },
});

// In-process access — same shape as `getAgent`, `getWorkflow`, etc.
const harness = mastra.getHarness('coding');
const session = await harness.session({ resourceId });
```

Single-harness sugar for the common case:

```ts
new Mastra({ harness: codingHarness });
// equivalent to:
new Mastra({ harness: { default: codingHarness } });

mastra.getHarness();           // returns the default harness
mastra.getHarness('default');  // same
```

`mastra.init()` calls `harness.init()` on every registered harness. `mastra.shutdown()` calls `harness.shutdown()` on every registered harness.
