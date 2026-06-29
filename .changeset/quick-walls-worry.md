---
'@mastra/playground-ui': minor
---

Added public subpath entrypoints for shared Playground UI domain components, hooks, resize helpers, primitives, and the playground store. Applications can now import focused APIs such as `TracesLayout` and `usePlaygroundStore` directly from those subpaths.

```ts
import { TracesLayout } from '@mastra/playground-ui/domains/traces/components/traces-layout';
import { usePlaygroundStore } from '@mastra/playground-ui/store/playground-store';
```
