---
'@mastra/playground-ui': minor
---

Removed the default DataList variant. DataList now uses the lined treatment when no variant is provided; use variant="striped" only when zebra rows are needed.

**Before**

```tsx
<DataList columns={columns} variant="default" />
```

**After**

```tsx
<DataList columns={columns} />
```
