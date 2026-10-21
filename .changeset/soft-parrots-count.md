---
'@mastra/playground-ui': minor
---

Added a `no-charges` illustration to `EmptyStateIllustration`: a receipt printer with a blank slip. On hover the slip feeds out a little further. Reduced motion keeps it still.

```tsx
<EmptyState iconSlot={<EmptyStateIllustration name="no-charges" />} titleSlot="No charges in this period" />
```
