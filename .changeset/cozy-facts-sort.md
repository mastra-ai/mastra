---
'@mastra/core': minor
---

Removed the deprecated `AISDKV5OutputStream` class from the public API.

**What changed:** The `AISDKV5OutputStream` class is no longer exported from `@mastra/core`. This class was previously used with the `format: 'aisdk'` option, which has already been removed from `.stream()` and `.generate()` methods.

**Who is affected:** Only users who were directly importing `AISDKV5OutputStream` from `@mastra/core`. If you were using the standard `.stream()` or `.generate()` methods without the `format` option, no changes are needed.

**Migration:** If you were importing this class directly, switch to using `MastraModelOutput` which provides the same streaming functionality:

```typescript
// Before
import { AISDKV5OutputStream } from '@mastra/core';

// After
import { MastraModelOutput } from '@mastra/core';
```
