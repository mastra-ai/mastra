---
'@mastra/playground-ui': minor
---

Added `iconSize` to `CopyButton`, to draw its icon smaller than the button while keeping the button's click target. `MessageCopyButton` uses it, so the copy icon in a message footer now matches the size of the timestamp beside it.

```tsx
<CopyButton content={text} size="icon-sm" iconSize="xs" tooltip="Copy message" />
```
