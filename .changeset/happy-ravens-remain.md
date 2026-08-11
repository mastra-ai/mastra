---
'@mastra/playground-ui': patch
---

Reworked the streaming shimmer so it reads as a sweep instead of a blink. The highlight travels through the text's own color, so a muted label stays muted and only brightens as the band passes through it. Readers who prefer reduced motion see the text unanimated.

```tsx
<Txt className="text-icon3">
  <Shimmer>Thinking</Shimmer>
</Txt>
```
