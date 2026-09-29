---
'@mastra/playground-ui': minor
---

Scroll areas now show taller vertical edge fades (3rem at the top, 5rem at the bottom), so it is clearer when a list scrolls.

**Breaking:** Removed the `viewPortClassName` prop from `ScrollArea`. To style the scrolling viewport, render the new `ScrollAreaViewport` as the direct child of `ScrollArea`. When you do not render it, `ScrollArea` adds it for you.

```tsx
// Before
<ScrollArea maxHeight="20rem" viewPortClassName="px-4">
  {items}
</ScrollArea>

// After
<ScrollArea maxHeight="20rem">
  <ScrollAreaViewport className="px-4">{items}</ScrollAreaViewport>
</ScrollArea>
```
