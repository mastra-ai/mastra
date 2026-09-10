---
'@mastra/playground-ui': minor
---

Added opt-in table actions to copy a single table as markdown or download it as CSV once its text finishes streaming. Markdown copies preserve formatting and referenced link and footnote definitions. CSV exports preserve cell text and footnote markers and protect against spreadsheet formula injection.

Enable the controls on `MarkdownRenderer` with `tableActions`:

```tsx
<MarkdownRenderer tableActions streaming={streaming}>
  {text}
</MarkdownRenderer>
```

Added a compact dropdown size for smaller controls. Set `size="sm"` on `DropdownMenu.Content` and `DropdownMenu.Item` to reduce padding, text size, and corner radius without changing other menus.

```tsx
<DropdownMenu.Content size="sm">
  <DropdownMenu.Item size="sm">Download CSV</DropdownMenu.Item>
</DropdownMenu.Content>
```
