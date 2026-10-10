---
'@mastra/playground-ui': minor
---

Added `Table` at `@mastra/playground-ui/new/table`, a simple data table built on native `table`, `tr`, `th`, and `td` elements with the same look as `DataList`. Use it for read-only data such as billing history or usage. Rows grow with their content, cells can hold any component or span rows and columns, and `columnDividers` draws lines between columns. Rows can link anywhere with `Table.RowLink`, which makes the whole row a real link you can tab to.

```tsx
import { Table } from '@mastra/playground-ui/new/table';

<Table aria-label="Credit history">
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
      <Table.Cell align="end" tone="muted">
        $6.95
      </Table.Cell>
    </Table.Row>
  </Table.Body>
</Table>;
```
