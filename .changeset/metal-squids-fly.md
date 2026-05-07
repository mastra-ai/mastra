---
'mastracode': minor
---

You can now pass a `memory` option to `createMastraCode()` to override the default memory instance or factory. This gives you a supported way to plug in custom memory behavior without depending on Mastra Code's default setup.

```ts
import { createMastraCode } from 'mastracode';

const mastraCode = await createMastraCode({
  memory: myCustomMemory,
});
```
