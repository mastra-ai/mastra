---
'@mastra/playground-ui': patch
---

`ScrollArea` gains `autoScrollStartFollowing` and `onAutoScrollFollowingChange`, so an auto-scrolling area that remounts can resume where the reader left it instead of jumping back to the end. `ScrollAreaViewport` takes `onScroll`, so a consumer can remember where the reader scrolled without attaching its own listener.

```tsx
<ScrollArea
  autoScroll
  autoScrollStartFollowing={view.following}
  onAutoScrollFollowingChange={following => (view.following = following)}
>
  <ScrollAreaViewport onScroll={saveScrollPosition}>{rows}</ScrollAreaViewport>
</ScrollArea>
```
