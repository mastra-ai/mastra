---
'@mastra/playground-ui': minor
---

`CopyButton` takes a `showToast` option, so a button whose icon already flips to a checkmark on success can skip the toast on top of it.

```tsx
<CopyButton content={message} showToast={false} />
```
