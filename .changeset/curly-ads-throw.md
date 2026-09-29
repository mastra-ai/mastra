---
'@mastra/playground-ui': minor
---

`ScrollArea` fade depth can now be set per side through `mask`. Fades stay 2rem deep by default; the main sidebar uses a 3rem top and 5rem bottom fade. A fade now grows with how far the content is scrolled from that edge, up to its depth, instead of appearing at full depth as soon as the content scrolls.

```tsx
<ScrollArea mask={{ top: '3rem', bottom: '5rem' }}>{items}</ScrollArea>
```

**Breaking:** Removed the `viewPortClassName` and `viewportRef` props from `ScrollArea`. To style or reach the scrolling viewport, render the new `ScrollAreaViewport` as the direct child of `ScrollArea` and pass it `className` or `ref`. When you do not render it, `ScrollArea` adds it for you.

```tsx
// Before
<ScrollArea maxHeight="20rem" viewPortClassName="px-4" viewportRef={scrollRef}>
  {items}
</ScrollArea>

// After
<ScrollArea maxHeight="20rem">
  <ScrollAreaViewport ref={scrollRef} className="px-4">
    {items}
  </ScrollAreaViewport>
</ScrollArea>
```

**Breaking:** Removed the deprecated `showMask` prop from `ScrollArea`. Use `mask` instead.
