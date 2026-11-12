---
'@mastra/playground-ui': minor
---

Added an `inline` variant to `CodeEditor` for editing prose in place: no border, background or gutter, and text lines up with the label above it.

```tsx
<CodeEditor variant="inline" language="markdown" value={text} onChange={setText} />
```
