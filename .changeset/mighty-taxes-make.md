---
'@mastra/server': patch
'@mastra/auth': patch
'@mastra/core': patch
---

Fixed a TypeScript error where auth provider instances (for example `new MastraAuthWorkos()`) could not be assigned to `server.auth` or `studio.auth`, failing with `Property '#private' is missing` (#18682).

Auth providers are now typed with a new structural `IMastraAuthProvider` interface (exported from `@mastra/core/server` and `@mastra/auth`), so provider packages no longer need a shared class identity with `@mastra/core`. `CompositeAuth` also accepts any `IMastraAuthProvider` implementation. No code changes are required:

```typescript
import { Mastra } from '@mastra/core';
import { MastraAuthWorkos } from '@mastra/auth-workos';

// Previously failed to compile with TS2322, now works without casts
export const mastra = new Mastra({
  server: {
    auth: new MastraAuthWorkos(),
  },
});
```
