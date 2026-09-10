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
