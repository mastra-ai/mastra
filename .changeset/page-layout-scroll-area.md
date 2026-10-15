---
'@mastra/playground-ui': patch
---

Changed `PageLayout` to scroll its body in a `ScrollArea` instead of reserving a stable scrollbar gutter. The body no longer shifts sideways when a scrollbar appears, and pages no longer show an empty strip beside their content. Added `contentClassName` to `ScrollAreaViewport` to style the wrapper around its children.

Added a `mask` prop to `PageLayout` to fade the body's scrolled edges, using the same values as `ScrollArea`. It is off by default. A fade covers whatever sits at that edge, so leave it off for bodies with sticky table headers.

```tsx
<PageLayout mask={{ y: true }}>{/* ... */}</PageLayout>
```
