---
'@mastra/playground-ui': patch
---

Fixed `Table.RowLink` and `Table.RowButton` in inset tables blocking clicks on other controls in Safari. The whole-row click area no longer comes from an overlay stretched over the row, which Safari let escape the row and cover the rest of the page. The row now hands plain clicks to its link or button itself. Tab and Enter still reach the real link, Cmd-click and middle-click on the link still open a new tab, and buttons, links, inputs and menus in the row keep their own clicks.
