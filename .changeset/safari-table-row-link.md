---
'@mastra/playground-ui': patch
---

Fixed `Table.RowLink` and `Table.RowButton` in inset tables blocking clicks on other controls in Safari. The whole-row click area no longer comes from an overlay stretched over the row, which Safari let escape the row and cover the rest of the page. The row now hands clicks to its link or button itself, so Cmd-click and middle-click still open a new tab, Tab and Enter still reach the real link, and buttons, links, inputs and menus in the row keep their own clicks.
