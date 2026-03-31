---
'@mastra/playground-ui': patch
---

**New components for the Logs MVP**

- `DataDetailsPanel` — composable detail panel with header, key-value list, code sections, and loading/empty states.
- `DataList` — generic data list with row links, top cells, skeleton loading, and pagination.
- `LogsDataList` — log-specific data list cells (level, date, time, entity, message).
- `SelectDataFilter` — dropdown filter with searchable categories, single/multi selection, and active count badge.

**`ListSearch`** now accepts a `size` prop to control input height:

```tsx
<ListSearch size="sm" onSearch={handleSearch} label="Filter" placeholder="Search..." />
```
