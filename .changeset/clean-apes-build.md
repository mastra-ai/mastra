---
'@mastra/playground-ui': minor
---

Added ClampedText, a design-system component that clamps text to a number of lines and shows a "Read more" toggle only when the clamp actually cuts content. Detection is based on the rendered layout (element measurement, re-checked on resize and after fonts load), not on character count.
