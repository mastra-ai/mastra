---
'@mastra/pg': patch
---

Fix SQL injection vulnerability in message metadata filtering

The metadata filtering implementation in the PostgreSQL memory storage had a critical SQL injection vulnerability where metadata keys were directly interpolated into the SQL query string without proper escaping.

**Vulnerability**: A malicious metadata key could potentially cause SQL injection.

**Fix**: Replaced unsafe key interpolation with parameterized JSONB containment operator (`@>`), following the same safe pattern used in thread metadata filtering.

**Before (vulnerable)**:
```typescript
conditions.push(`content->'metadata'->>'${key}' = $${paramIndex++}`);
```

**After (safe)**:
```typescript
conditions.push(`content::jsonb @> $${paramIndex++}::jsonb`);
queryParams.push(JSON.stringify({ metadata: { [key]: value } }));
```
