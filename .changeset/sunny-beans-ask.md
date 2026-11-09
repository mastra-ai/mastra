---
'@mastra/playground-ui': minor
---

Added in-place renaming for dashboard widget titles. Pass `onTitleChange` to `StatelessWidget` (or `ChartCard`) and plain titles become editable: hover or focus shows a dashed outline, Enter or clicking away saves the trimmed title, and Escape cancels. Titles with a view menu or an expand link stay read-only. Saving the new title is up to you.

```tsx
<StatelessWidget {...widgetProps} onTitleChange={title => saveWidget({ ...widget, title })} />
```
