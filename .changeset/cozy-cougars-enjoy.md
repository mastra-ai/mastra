---
'@mastra/playground-ui': minor
---

Added an `insideFields` option to `useKeydown`. By default, keys without a modifier are left to the focused text field, menu, or dialog. With `insideFields: true`, they also fire there, so Escape can close a panel while the user is typing in it.

```tsx
useKeydown({ Escape: closePanel }, { insideFields: true });
```

Keys a widget already handled, such as Escape closing an open menu, still don't reach the handler.
