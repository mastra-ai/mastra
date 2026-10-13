---
'@mastra/playground-ui': minor
---

Added `variant="inset"` to `Table` from `@mastra/playground-ui/components/Table`. It gives a native table the same raised look as `DataList`, with rows that grow with their content and cells that can hold any component. Existing default and small tables render exactly as before.

The inset variant comes with composable parts:

- `Table.RowLink` and `Table.RowButton` make a whole row a link or a button, and other controls in the row keep their own clicks.
- `Table.SortButton` turns a header into a sort control with a direction arrow.
- `Table.Pagination` adds numbered pages below the table; the page and rows stay in your code.
- `columnDividers` draws lines between columns.

```tsx
import { Table } from '@mastra/playground-ui/components/Table';

<Table variant="inset" aria-label="Credit history">
  <Table.Header>
    <Table.Row>
      <Table.Head>Type</Table.Head>
      <Table.Head align="end">Balance</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    <Table.Row>
      <Table.Cell>
        <Table.RowLink href="/credits/1">Credit grant</Table.RowLink>
      </Table.Cell>
      <Table.Cell align="end">$6.95</Table.Cell>
    </Table.Row>
  </Table.Body>
</Table>;
```
