---
'@mastra/playground-ui': patch
---

Improved `ScrollArea` to use Base UI internally and added a richer mask API. Edges now fade by default based on `orientation` (top/bottom for vertical, left/right for horizontal, all four for both), so most scrollers get the polished fade-out automatically.

The new `mask` prop replaces `showMask` and accepts either a boolean (`false` disables fading entirely) or an object to override individual sides. The `x` and `y` keys are shorthands for the matching axis.

```tsx
// Default — fades follow `orientation`
<ScrollArea>...</ScrollArea>

// Opt out entirely
<ScrollArea mask={false}>...</ScrollArea>

// Keep only the top fade
<ScrollArea mask={{ bottom: false }}>...</ScrollArea>

// Vertical fades only on a two-axis scroller
<ScrollArea orientation="both" mask={{ x: false }}>...</ScrollArea>
```
