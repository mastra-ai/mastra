---
'@mastra/playground-ui': patch
---

Added `FilterBar`, a composable filter component for building field → operator → value filters from a single typeahead input. Committed filters render as inline chips whose field, operator and value can each be edited in place with the mouse or the keyboard (arrow keys move across chips and segments, Enter edits, Delete removes, Escape/Backspace step back).

Fields, operators and values are plain strings; the component applies no business typing. Value suggestions can be a static list or a lazy resolver that is only called once a field and operator have been chosen.

```tsx
import { FilterBar, DEFAULT_FILTER_OPERATORS } from '@mastra/playground-ui/components/FilterBar';

<FilterBar fields={fields} operators={DEFAULT_FILTER_OPERATORS} value={items} onValueChange={setItems}>
  <FilterBar.Chips />
  <FilterBar.Input placeholder="Filter…" />
  <FilterBar.Clear />
</FilterBar>;
```
