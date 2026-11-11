---
'@mastra/playground-ui': minor
---

`InputGroupAddon` now insets its icon like a Button does (the group's `--control-px` and `--control-gap`), so a leading or trailing icon in any field lines up with the icons of the controls beside it. A field built from `InputGroup` parts by hand gets the same inset as `SearchInput`.

`SearchInput` is now plain `InputGroup` composition (a search icon, the input and a clear button) with no styling of its own, and it takes over `ListSearch`'s behaviour: `debounceMs`, the Cmd/Ctrl+Shift+F `shortcut`, and keeping its own text when no `value` is passed. `ListSearch` and `SearchFieldBlock` are removed.

**Migrating**

```tsx
// Before
<ListSearch onSearch={setSearch} label="Search agents" placeholder="Search by name" />

// After
<SearchInput size="sm" debounceMs={300} shortcut onValueChange={setSearch} label="Search agents" placeholder="Search by name" />
```

- `ListSearch`'s `onSearch` → `onValueChange`; `shortcutDisabled` → leave out `shortcut`. It defaulted to `size="sm"` and a 300ms debounce; pass them.
- `SearchFieldBlock` → `SearchInput`, inside a `Field` when it needs a visible label.
- `SearchInput`'s `label` is now the input's `aria-label` instead of a visually hidden `<label>`.
