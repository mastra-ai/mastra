---
'@mastra/playground-ui': minor
---

Added an `inline` variant to `DataPanel` that renders the panel in the normal page flow instead of a modal side drawer. Use it to embed detail views directly in a layout (no backdrop, focus trap, or dismissal). The parent controls mounting and size.

```tsx
<DataPanel variant="inline" title="Span details">
  <DataPanel.Header>
    <DataPanel.Heading>Span details</DataPanel.Heading>
  </DataPanel.Header>
  <DataPanel.Content>…</DataPanel.Content>
</DataPanel>
```
