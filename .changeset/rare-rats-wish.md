---
'@mastra/core': minor
---

Existing `@mastra/core/harness` imports continue to work unchanged while the current implementation is also available as `HarnessLegacy` for migration code that needs to refer to the legacy runtime explicitly.

```ts
import { Harness, HarnessLegacy } from '@mastra/core/harness';
```
