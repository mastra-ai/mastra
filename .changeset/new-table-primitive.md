---
'@mastra/playground-ui': minor
---

Added an opt-in `variant="inset"` to the existing `Table` at `@mastra/playground-ui/components/Table`, a simple data table built on native `table`, `tr`, `th`, and `td` elements with the same look as `DataList`. Existing default and small tables keep their rendering and behavior. Use the inset variant for data such as billing history or usage. Rows grow with their content, cells can hold any component, and `columnDividers` draws lines between columns. Rows can link anywhere with `Table.RowLink`, which makes the whole row a real link you can tab to. Compose `Table.Pagination` below the table for numbered, caller-controlled pages.

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
