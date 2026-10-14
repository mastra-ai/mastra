---
'@mastra/playground-ui': patch
---

Made the reserved scrollbar gutter on `PageLayout` optional. It stays on by default; pass `stableGutter={false}` for pages that do not want the gutter reserved.

```tsx
<PageLayout variant="fit" stableGutter={false}>{/* ... */}</PageLayout>
```
