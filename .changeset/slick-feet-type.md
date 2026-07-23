---
'@mastra/playground-ui': minor
---

Added a `revealScrollbarOnHover` prop to `ScrollArea`. Set it to `false` to keep the overlay scrollbar hidden until the user actively scrolls, instead of also revealing it when the pointer hovers the area. Defaults to `true`, so existing usage is unchanged.

```tsx
<ScrollArea revealScrollbarOnHover={false}>{content}</ScrollArea>
```
