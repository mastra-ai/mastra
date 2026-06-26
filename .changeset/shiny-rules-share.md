---
'@mastra/core': patch
---

Added a browser-safe `@mastra/core/utils/collect-tool-mocks` export for `collectToolMocks`. The previous `@mastra/core/evals` barrel pulls in Node-only modules (`node:crypto`), which broke bundling in browser apps such as the Studio playground. Import the helper from the new subpath in browser code:

```ts
import { collectToolMocks } from '@mastra/core/utils/collect-tool-mocks';
```

The `@mastra/core/evals` export still works for Node-side callers.
