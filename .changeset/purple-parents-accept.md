---
'@mastra/core': patch
---

Added `normalizeRoutePath` utility function for consistent route path handling.

This utility ensures route paths are normalized with a leading slash, no trailing slash, and validates against path traversal attempts. Useful when building custom server integrations or working with route prefixes.

```typescript
import { normalizeRoutePath } from '@mastra/core/utils';

normalizeRoutePath('api');      // '/api'
normalizeRoutePath('/api/');    // '/api'
normalizeRoutePath('//api//v1'); // '/api/v1'
normalizeRoutePath('/');        // ''
```

See #12261 for more details.
