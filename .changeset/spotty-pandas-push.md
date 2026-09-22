---
'@mastra/playground-ui': minor
---

**FilterBar: a field that takes plain typed text**

A field marked `search` stays pinned at the top of the field list whatever is typed, so text that names no field still commits as a filter instead of forcing a field pick first. Options also take a `start` node rendered before their label, for an avatar or an icon.

```tsx
<FilterBar
  fields={[
    { id: 'text', label: 'Text', search: true, operators: ['contains'] },
    {
      id: 'teammate',
      label: 'Teammate',
      operators: ['is'],
      suggestions: [{ value: 'github:alice', label: 'Alice', start: <Avatar name="Alice" /> }],
    },
  ]}
  operators={DEFAULT_FILTER_OPERATORS}
  value={items}
  onValueChange={setItems}
>
  <FilterBar.Chips />
  <FilterBar.Input />
</FilterBar>
```

Typing `flaky login` and pressing Enter now commits `Text contains flaky login`; `Teammate` is one arrow below.

Fixed: the option list opens on its first row again after a field is picked or a chip is committed with the keyboard. It used to keep the highlight index of the list it replaced, so a field reached with ArrowDown opened the value list on its second option.
