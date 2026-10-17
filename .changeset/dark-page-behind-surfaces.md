---
'@mastra/playground-ui': patch
---

Changed how surfaces stack in the dark theme. The page is now the darkest surface, sitting behind everything, and the sidebar and cards share one lighter surface on top of it, instead of three steps with the sidebar darkest and cards lightest. Popovers, menus and dialogs sit one step above cards, and fields inside cards one step above the card. Borders are unchanged, and the light theme is unchanged.
