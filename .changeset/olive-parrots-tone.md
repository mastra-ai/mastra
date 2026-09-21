---
'@mastra/playground-ui': minor
---

Renamed the `Txt` neutral tone from `default` to `ink`, so the three tones read as one ladder — ink, muted, faint. `default` invited you to write the tone you already get: the page body carries the ink colour, so leaving `tone` off inherits it. Write a tone only when the text departs from it, including lifting a line back to ink inside a muted block.

If you passed `tone="default"`, drop it or use `tone="ink"` where the text sits in a muted block:

**Before**

```tsx
<Txt variant="body" tone="default">Title</Txt>
<Txt variant="caption" className="text-muted-foreground">Supporting copy</Txt>
```

**After**

```tsx
<Txt variant="body">Title</Txt>
<Txt variant="caption" tone="muted">Supporting copy</Txt>
```

Setting the colour through `className` still works, but `tone` is the supported way to reach the three neutral inks.
