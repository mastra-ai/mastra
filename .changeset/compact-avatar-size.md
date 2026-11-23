---
'@mastra/playground-ui': minor
---

Added a 20px `compact` size to `Avatar`, `Avatar.Group` and `ProductAvatar`, between `inline` (16px) and `sm` (24px), with the `avatar-compact` spacing token. Use it next to a heading or on a card, where `sm` is too big.

```tsx
<Avatar.Group size="compact">
  <ProductAvatar product="studio" />
  <ProductAvatar product="server" />
</Avatar.Group>
```
