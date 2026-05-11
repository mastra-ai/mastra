---
'@mastra/playground-ui': minor
---

Improved `ScrollArea` to use Base UI internally and added a richer mask API. Edges now fade by default based on `orientation` (top/bottom for vertical, left/right for horizontal, all four for both), so most scrollers get the polished fade-out automatically.

**Heads up — default behavior change:** `ScrollArea` previously rendered without any edge fade unless `showMask` was passed. It now fades the edges that match `orientation` by default. Pass `mask={false}` on the callsites where you want to keep the old hard edges.

**New `mask` prop.** Accepts a boolean (`false` disables the fade entirely) or an object to override individual sides. The `x` and `y` keys are shorthands for the matching axis.

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

**Migrating from `showMask`.** The `showMask` boolean is now deprecated but still works — `mask` wins when both are set.

```tsx
// Before
<ScrollArea showMask>...</ScrollArea>
<ScrollArea showMask={false}>...</ScrollArea>

// After
<ScrollArea>...</ScrollArea>             // default fade matches orientation
<ScrollArea mask={false}>...</ScrollArea> // explicitly disable
```
