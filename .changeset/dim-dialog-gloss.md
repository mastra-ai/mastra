---
'@mastra/playground-ui': patch
---

Removed the inset top gloss from the `shadow-dialog` token. The gloss read as a faint highlight band along the top edge of dropdown menus, popovers, selects, comboboxes, dialogs, tooltips, side dialogs and the main app container in dark mode. The token now applies a drop-shadow only and is consistent across light and dark themes.
