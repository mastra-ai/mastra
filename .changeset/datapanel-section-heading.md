---
'@mastra/playground-ui': patch
---

Added a `DataPanel.SectionHeading` component for small-caps section labels (with an optional leading icon) inside a `DataPanel.Content`. `DataCodeSection` now renders through it, and `DataPanel.Header` hides its bottom border when the panel is collapsed (header-only) so an empty panel no longer shows a stray divider.

```tsx
<DataPanel.SectionHeading icon={<FileInputIcon />}>Input</DataPanel.SectionHeading>
```
