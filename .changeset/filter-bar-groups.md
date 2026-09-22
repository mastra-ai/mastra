---
'@mastra/playground-ui': minor
---

Added a Linear-style **Advanced filter** to `FilterBar`, so filters can be combined with `and` / `or` instead of only being ANDed together.

Pass a `FilterBarExpression` as `value` to opt in. Top-level chips stay flat and implicitly ANDed; each top-level group renders as a single **Advanced filter · N** chip that opens a popover with a recursive rule builder: one editable chip per condition laid out as `where` / `and` / `or` rows, nested groups as cards with their own `and` | `or` switch, and `+ Condition` / `+ Group` / `Clear all` footers. From the bar input, pick **Advanced filter…** at the end of the field list to create a group and start adding conditions into it. Empty groups are pruned when the popover closes. Nesting depth is bounded by the new `maxDepth` prop (default `3`).

A flat `FilterBarItem[]` value keeps working unchanged and never shows the option.

```tsx
import { FilterBar, type FilterBarExpression } from '@mastra/playground-ui';

const [value, setValue] = useState<FilterBarExpression>({
  logic: 'and',
  nodes: [
    { id: '1', fieldId: 'status', operatorId: 'is', value: 'error' },
    {
      id: 'g1',
      kind: 'group',
      logic: 'or',
      nodes: [
        { id: '2', fieldId: 'env', operatorId: 'is', value: 'prod' },
        { id: '3', fieldId: 'env', operatorId: 'is', value: 'staging' },
      ],
    },
  ],
});

<FilterBar fields={fields} operators={operators} value={value} onValueChange={setValue}>
  <FilterBar.Chips />
  <FilterBar.Input />
</FilterBar>;
```
