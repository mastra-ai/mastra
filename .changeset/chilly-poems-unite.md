---
'@mastra/core': major
---

Removed the legacy harness v1 entrypoint.

**Breaking change**

Imports from `@mastra/core/harness/v1` no longer work. Use the stable harness entrypoint instead.

**Before**

```ts
import { Harness } from '@mastra/core/harness/v1';
```

**After**

```ts
import { Harness } from '@mastra/core/harness';
```
