---
'@mastra/playground-ui': patch
---

Fixed the FilterBar hover highlight flashing back to the first row when the pointer moves quickly between options. Also, entering a menu, select, combobox or filter list whose row is already lit no longer makes the highlight fade out and back in; it slides to the pointer instead.
