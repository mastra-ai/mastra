---
'@mastra/playground-ui': patch
---

Simplify the `DataList.SortableTopCell` API. The cell now takes a `sortKey`, an optional controlled `sort` (`'asc' | 'desc'`, omitted when the column is not sorted), and `onSortChange(sort, key)` receives the next sort along with the column key so one handler can serve every column. `sortDirection` and `defaultSortDirection` are removed, and the `DataListSortDirection` type is replaced by `DataListSort`.

```tsx
const [sort, setSort] = useState<{ key: string; value: DataListSort }>({ key: 'createdAt', value: 'desc' });
const handleSort = (value: DataListSort, key: string) => setSort({ key, value });

<DataList.SortableTopCell sortKey="createdAt" sort={sort.key === 'createdAt' ? sort.value : undefined} onSortChange={handleSort}>
  Date
</DataList.SortableTopCell>
```
