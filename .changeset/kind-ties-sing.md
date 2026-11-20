---
'@mastra/playground-ui': minor
---

The scroll-to-latest button is bigger (a round 32px control instead of a 20px chip), and `MessageScrollerButton` / `ChatShell.ScrollButton` take a `busy` prop: while a reply is still streaming in below, the button grows into a pill with a pulsing "•••" beside the arrow.

```tsx
<ChatShell.ScrollButton busy={isRunning} />
```
