---
'@mastra/playground-ui': minor
---

Added `opensView` to sidebar links. A link with `opensView: true` shows a trailing caret so users can tell it opens its own navigation view.

```tsx
<Sidebar.Sections
  sections={[{ key: 'infra', links: [{ name: 'Gateway', url: '/gateway', icon: <GatewayIcon />, opensView: true }] }]}
/>
```
