---
'@mastra/apple-container': minor
---

Add an Apple container CLI workspace sandbox provider.

```ts
import { AppleContainerSandbox } from '@mastra/apple-container';

const sandbox = new AppleContainerSandbox({
  id: 'local-apple-container',
  image: 'node:22-slim',
  volumes: { [process.cwd()]: '/workspace' },
});
```
