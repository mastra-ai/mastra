---
'@mastra/playground-ui': patch
---

Added direct subpath imports for shared Playground UI domain components, hooks, resize helpers, primitives, and the playground store. This lets applications avoid the root barrel when they only need one focused API.

```ts
import { TracesLayout } from '@mastra/playground-ui/domains/traces/components/traces-layout';
import { usePlaygroundStore } from '@mastra/playground-ui/store/playground-store';
```
