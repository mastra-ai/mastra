---
'@mastra/mesa': minor
---

Upgrade to `@mesadev/sdk` 0.49.1. `MesaFilesystem` now authenticates with a Mesa private key and mounts a Mesa layout, matching the current Mesa SDK.

**Breaking:** replace `apiKey`, `org`, and `repos` with `privateKey`, `authors`, and `layout`. Paths now start at the layout path instead of `/<org>/<repo>`.

```ts
import { MesaFilesystem, repo } from '@mastra/mesa';

new MesaFilesystem({
  privateKey: process.env.MESA_PRIVATE_KEY,
  authors: [{ name: 'My Agent', email: 'agent@example.com' }],
  layout: { '/docs': repo('docs', { mode: 'rw', at: { bookmark: 'main' } }) },
});
```
