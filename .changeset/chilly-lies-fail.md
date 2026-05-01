---
'@mastra/playground-ui': patch
---

Added support for icon-and-description layout in `Notice` by making `title` optional. When omitted, the notice renders as a single row with icon and description, useful for inline contextual messages.

```tsx
// Before — title required
<Notice variant="info" title="Heads up">Some message.</Notice>

// After — title optional, single-row layout
<Notice variant="info">Some message.</Notice>
```
