---
'@mastra/playground-ui': minor
---

A search field is now an `InputGroup` with a search icon, like any other field with an icon. `SearchInput`, `ListSearch` and `SearchFieldBlock` are removed.

`InputGroupAddon` now insets its icon like a Button does (the group's `--control-px` and `--control-gap`), so a leading or trailing icon in any field lines up with the icons of the controls beside it, whether or not it is a search.

A list page's search behaviour (debounce, clear, and the Cmd/Ctrl+Shift+F focus shortcut) moves to the `useListSearch` hook in `@mastra/playground-ui/hooks/use-list-search`.

**Migrating**

```tsx
// Before
<ListSearch onSearch={setSearch} label="Search agents" placeholder="Search by name" />;

// After
const search = useListSearch({ onSearch: setSearch });

<InputGroup size="sm" className="w-full max-w-120">
  <InputGroupAddon>
    <SearchIcon />
  </InputGroupAddon>
  <InputGroupInput {...search.inputProps} aria-label="Search agents" placeholder="Search by name" />
  {search.value && (
    <InputGroupAddon align="inline-end">
      <InputGroupButton aria-label="Clear search" onClick={search.clear}>
        <XIcon />
      </InputGroupButton>
    </InputGroupAddon>
  )}
</InputGroup>;
```

- `ListSearch`'s `value` and `shortcutDisabled` map to `useListSearch`'s `value` and `shortcut: false`.
- A controlled `SearchInput` becomes `<InputGroupInput type="search" value={value} onChange={…} />` in the same group; its `label` becomes the input's `aria-label`, and `onClose` an inline-end `InputGroupButton`.
- `SearchFieldBlock` → the same composition inside a `Field` when it needs a visible label.
