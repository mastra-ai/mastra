---
'@mastra/playground-ui': minor
---

Removed the `variant` prop from `SearchFieldBlock` and `ListSearch`. Both components now always render the filled `Input` surface, so there is a single consistent look for search fields across Studio.

If you passed `variant` to either component, remove it:

**Before**

```tsx
<SearchFieldBlock label="Search" variant="outline" size="sm" />
<ListSearch label="Filter agents" variant="outline" />
```

**After**

```tsx
<SearchFieldBlock label="Search" size="sm" />
<ListSearch label="Filter agents" />
```
