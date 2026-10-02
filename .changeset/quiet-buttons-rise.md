---
'@mastra/playground-ui': patch
---

Fixed default buttons blending into cards. A default `Button` now uses the same fill and edge as the inputs beside it in light and dark themes, so it stands out on a card, settings group, or dialog instead of matching it. Selects and inputs inside a `ButtonsGroup` now show a single line at each seam instead of two.
