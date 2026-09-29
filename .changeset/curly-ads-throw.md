---
'@mastra/playground-ui': minor
---

`ScrollArea` fade depth can now be set per side through `mask`. Fades stay 2rem deep by default; the main sidebar uses a 3rem top and 5rem bottom fade.

```tsx
<ScrollArea mask={{ top: '3rem', bottom: '5rem' }}>{items}</ScrollArea>
```

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
