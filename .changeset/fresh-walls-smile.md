---
'@mastra/storage': minor
---

Added the new `@mastra/storage` package for shared storage adapter utilities.

- Added shared table constants, schema definitions, pagination helpers, SQL identifier utilities, and storage data types for adapter packages
- Kept `MastraCompositeStore`, storage interfaces, and domain base classes in `@mastra/core/storage`

**Example**

```ts
import { TABLE_SCHEMAS, createStorageErrorId } from '@mastra/storage';
import { MastraCompositeStore } from '@mastra/core/storage';
```
