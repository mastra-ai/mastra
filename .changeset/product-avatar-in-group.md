---
'@mastra/playground-ui': minor
---

Added a `size` prop to `ProductAvatar` and made it work inside `Avatar.Group`. In a group it takes the group's size and gets the same overlap ring as other avatars. Standalone `ProductAvatar` keeps its current size.

```tsx
<Avatar.Group size="md">
  <ProductAvatar product="studio" />
  <ProductAvatar product="observability" />
  <Avatar.GroupCount>+3</Avatar.GroupCount>
</Avatar.Group>
```
