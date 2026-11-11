---
'@mastra/playground-ui': minor
---

Smooth corners: every `rounded-*` class now draws Figma-style smoothed corners (corner smoothing 0.65) in browsers that support CSS `corner-shape`. Radii stay the same, pills become soft capsules and circles stay round. Safari and older Firefox look exactly as before.

Apps that compile their own Tailwind with `theme.css` can smooth their own classes too:

```css
@import '@mastra/playground-ui/theme.css';
@import '@mastra/playground-ui/smooth-corners.css';
```
