---
'@mastra/playground-ui': patch
---

Reworked the streaming shimmer so it reads as a sweep instead of a blink. The highlight now travels relative to the text's own color, so muted text stays muted and only brightens as the band passes through it — a label keeps its place in the type hierarchy while it is in flight.

```tsx
<Txt className="text-icon3">
  <Shimmer>Thinking</Shimmer>
</Txt>
```
