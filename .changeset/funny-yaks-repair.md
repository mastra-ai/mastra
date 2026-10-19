---
'@mastra/playground-ui': minor
---

Added an `inline` size for `Avatar`, `Avatar.Group` and `ProductAvatar` (16px), for avatars that sit next to text, such as in a table row. The notch between stacked avatars is now thinner at the `xs` and `inline` sizes, so it no longer swallows the avatar behind.

```tsx
<Avatar.Group size="inline">
  <ProductAvatar product="server" />
  <ProductAvatar product="studio" />
</Avatar.Group>
```
