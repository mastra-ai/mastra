---
'@mastra/playground-ui': patch
---

Fixed lighter spots in the empty state, billing and project size illustrations where two lines cross or meet. Every line now keeps one even color.

Added the `line-art` utility for SVG line drawings on `fill-background` plates. It paints lines with a stroke opacity of 0.35, 0.5, 0.7 or 0.75 in an opaque color, so crossings stay even:

```tsx
<svg className="line-art">
  <path className="fill-background" stroke="currentColor" strokeOpacity="0.7" d="…" />
</svg>
```
