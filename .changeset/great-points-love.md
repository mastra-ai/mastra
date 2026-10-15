---
'@mastra/playground-ui': patch
---

Added `describeSuggestionsError` to `FilterBar` so apps can explain why value suggestions failed to load, for example when a server limit was hit. Return `undefined` to keep the default "Couldn't load values." text.

```tsx
<FilterBar
  fields={fields}
  operators={operators}
  value={value}
  onValueChange={setValue}
  describeSuggestionsError={error => (isTooExpensive(error) ? 'Too many values. Narrow the time range.' : undefined)}
>
  <FilterBar.Chips />
  <FilterBar.Input />
</FilterBar>
```
