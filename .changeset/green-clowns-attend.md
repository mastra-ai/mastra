---
'@mastra/core': minor
---

Added `getProjectRoot` and `resolveFromProjectRoot` utilities for path resolution.

These utilities find the project root by searching upward for the nearest `package.json` and can resolve relative paths from that location:

```typescript
import { getProjectRoot, resolveFromProjectRoot } from '@mastra/core/utils';

// Find project root
getProjectRoot(); // → /Users/me/project

// Resolve relative paths from project root
resolveFromProjectRoot('./data/db.sqlite'); // → /project/data/db.sqlite

// Absolute paths returned as-is
resolveFromProjectRoot('/var/data/db.sqlite'); // → /var/data/db.sqlite
```
