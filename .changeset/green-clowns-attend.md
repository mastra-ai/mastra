---
'@mastra/core': minor
'@mastra/duckdb': patch
'@mastra/libsql': patch
---

Added getProjectRoot and resolveFromProjectRoot utilities for consistent path resolution.

**Problem:** Relative file paths (like `file:./mastra.db`) resolved from `process.cwd()`, which varies depending on execution context. For example, `mastra dev` sets cwd to `src/mastra/public/`, causing paths to resolve incorrectly.

**Solution:** New utilities that resolve relative paths from the project root (nearest `package.json`):

```typescript
import { resolveFromProjectRoot } from '@mastra/core/utils';

// Relative paths → resolved from project root
resolveFromProjectRoot('./data/db.sqlite'); // → /project/data/db.sqlite

// Absolute paths → returned as-is
resolveFromProjectRoot('/var/data/db.sqlite'); // → /var/data/db.sqlite
```

LibSQLStore and DuckDBVector now automatically resolve relative paths from project root.
