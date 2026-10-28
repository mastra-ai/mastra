---
'@mastra/playground-ui': patch
---

Added `autoScrollStartFollowing` and `onAutoScrollFollowingChange` to `ScrollArea`. A live list that mounts again can now stay where the reader scrolled it, instead of jumping back to the end.

```tsx
<ScrollArea
  autoScroll={live}
  autoScrollStartFollowing={wasFollowing}
  onAutoScrollFollowingChange={following => remember(following)}
>
  {rows}
</ScrollArea>
```
