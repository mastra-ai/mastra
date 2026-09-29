---
'@mastra/playground-ui': patch
---

Added a `repeat` option to `useKeydown`. Set it to `false` so holding a key runs the handler once instead of on every key repeat, which suits toggles:

```tsx
useKeydown({ '[': toggleSidebar }, { repeat: false });
```
