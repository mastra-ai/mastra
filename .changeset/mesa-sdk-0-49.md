---
'@mastra/mesa': minor
---

Upgraded to `@mesadev/sdk` 0.49.1. `MesaFilesystem` now authenticates with a Mesa private key and mounts a Mesa layout, matching the current Mesa SDK. `privateKey` falls back to `MESA_PRIVATE_KEY` when omitted.

**Breaking:** `apiKey`, `org`, and `repos` are replaced by `privateKey`, `authors`, and `layout`. Paths now start at the layout path instead of `/<org>/<repo>`.

**Before**

```ts
import { MesaFilesystem } from '@mastra/mesa';

const filesystem = new MesaFilesystem({
  apiKey: process.env.MESA_API_KEY,
  org: 'acme',
  repos: [{ name: 'docs', bookmark: 'main' }],
});

await filesystem.readFile('/acme/docs/README.md');
```

**After**

```ts
import { MesaFilesystem, repo } from '@mastra/mesa';

const filesystem = new MesaFilesystem({
  privateKey: process.env.MESA_PRIVATE_KEY,
  authors: [{ name: 'My Agent', email: 'agent@example.com' }],
  layout: { '/docs': repo('docs', { mode: 'rw', at: { bookmark: 'main' } }) },
});

await filesystem.readFile('/docs/README.md');
```
