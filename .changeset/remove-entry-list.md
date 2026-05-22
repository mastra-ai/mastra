---
'@mastra/playground-ui': patch
---

Removed `EntryList` and its sub-components (`EntryList.Header`, `EntryList.Entries`, `EntryList.Entry`, `EntryList.EntryText`, `EntryList.Pagination`, `EntryList.NoMatch`, `EntryListSkeleton`, etc.) from the public API. All in-repo list views have migrated to `DataList`, which is the recommended replacement.

**Migration:**

```tsx
// Before
import { EntryList, EntryListSkeleton } from '@mastra/playground-ui';

<EntryList>
  <EntryList.Trim>
    <EntryList.Header columns={columns} />
    <EntryList.Entries>
      {items.map(item => (
        <EntryList.Entry key={item.id} columns={columns} entry={item} onClick={…}>
          {columns.map(col => <EntryList.EntryText key={col.name}>{item[col.name]}</EntryList.EntryText>)}
        </EntryList.Entry>
      ))}
    </EntryList.Entries>
  </EntryList.Trim>
  <EntryList.Pagination …/>
</EntryList>

// After
import { DataList } from '@mastra/playground-ui';

<DataList columns={gridColumns}>
  <DataList.Top>
    {columns.map(col => <DataList.TopCell key={col.name}>{col.label}</DataList.TopCell>)}
  </DataList.Top>
  {items.map(item => (
    <DataList.RowButton key={item.id} onClick={…}>
      {columns.map(col => <DataList.Cell key={col.name}>{item[col.name]}</DataList.Cell>)}
    </DataList.RowButton>
  ))}
  <DataList.Pagination …/>
</DataList>
```
