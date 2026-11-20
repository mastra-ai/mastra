---
'@mastra/playground-ui': minor
---

The scroll-to-latest button is a round 32px control with a muted arrow, lifted by soft shadows instead of a border, matching the composer. `MessageScrollerButton` / `ChatShell.ScrollButton` take a `busy` prop: while a reply is still streaming in below, the arrow gives way to a small stroke drawn as if by a pen, written in and chased off in a loop, in the same spot.

```tsx
<ChatShell.ScrollButton busy={isRunning} />
```
