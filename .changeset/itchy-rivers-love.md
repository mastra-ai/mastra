---
'@mastra/playground-ui': patch
---

Fixed drawers rendering a bright outline in apps that load Tailwind after the playground-ui stylesheet. Drawers now draw a single edge from the surface rim, like dialogs, instead of stacking a border on top of it.
