---
'@mastra/playground-ui': minor
---

Added a `label` prop to `RelativeTimestamp` that names what the moment refers to. The tooltip then reads `Deployed 12 hours 4 minutes ago` instead of a bare time.

```tsx
<RelativeTimestamp value={deploy.createdAt} label="Deployed" />
```
