---
'@mastra/playground-ui': major
'mastracode': patch
---

Removed named exports from the `@mastra/playground-ui` root entry. Import public APIs from exact package subpaths instead.

**Before**

```ts
import { Button } from '@mastra/playground-ui';
```

**After**

```ts
import { Button } from '@mastra/playground-ui/components/Button';
```

`mastracode` now uses the exact subpath imports, and lint rules prevent new broad `@mastra/playground-ui` imports.
