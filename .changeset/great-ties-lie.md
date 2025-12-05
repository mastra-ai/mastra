---
'@mastra/core': patch
---

Added the ability to provide a base path for Mastra Studio.

```ts
import { Mastra } from '@mastra/core';

export const mastra = new Mastra({
  server: {
    studioBase: '/my-mastra-studio',
  },
});
```

This will make Mastra Studio available at `http://localhost:4111/my-mastra-studio`.
