---
'@mastra/playground-ui': minor
---

Matched icon sizing and stroke weight to the control scale.

Icons had three sizing systems at once: icon-only buttons read one map, the `icon` prop read another, and a bare SVG child scaled with `1.1em`. At `lg` the same nominal size rendered a 20px, 16px, or 15.39px icon depending on which path a caller used, and the em-relative path produced fractional sizes that render soft.

There is now one icon step per control step, 12 / 14 / 16 / 20 for `xs` / `sm` / `md` / `lg`, and all three paths read from it.

Stroke weight is pinned per size so every icon draws a ~1px line. Lucide ships `stroke-width: 2` on a 24 viewBox, so a rendered stroke was `size / 12`: 1px at 12px but 1.67px at 20px, which made large icons read heavier than small ones. `Icon` also accepts a new `smd` size (14px).
