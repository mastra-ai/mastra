---
'@mastra/playground-ui': patch
---

Fixed clicks on a toggle placed inside a menu activating the menu's last highlighted row. Clicking a theme toggle between DropdownMenu rows used to open whichever row was highlighted last, often a link; radios, checkboxes, switches, sliders, tabs and their groups now keep their own clicks.
