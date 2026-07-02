---
'@mastra/mesa': minor
---

Added a Mesa filesystem provider for Mastra workspaces.

```ts
import { Workspace } from '@mastra/core/workspace';
import { MesaFilesystem } from '@mastra/mesa';

const workspace = new Workspace({
  filesystem: new MesaFilesystem({
    apiKey: process.env.MESA_API_KEY,
    org: 'acme',
    repos: [{ name: 'docs', bookmark: 'main' }],
  }),
});
```
