---
'@mastra/playground-ui': patch
---

Made the reserved scrollbar gutter optional on `ChatShell.Viewport` and `PageLayout`. Both keep it by default; pass `stableGutter={false}` for hosts that do not want the gutter reserved.

```tsx
<PageLayout variant="fit" stableGutter={false}>{/* ... */}</PageLayout>
<ChatShell.Viewport stableGutter={false}>{/* ... */}</ChatShell.Viewport>
```
