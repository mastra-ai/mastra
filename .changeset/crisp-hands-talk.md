---
'@mastra/playground-ui': patch
---

Fixed the hover highlight in menus, selects, comboboxes and the filter bar blinking or jumping back to the first row when the pointer moves quickly between items. The highlight now follows the pointer while it moves and follows the keyboard again once a key is pressed. Entering a menu whose row is already lit no longer makes the highlight fade out and back in.

Removed `sessionRef` and `handlers.onMouseEnter` from the `useFluidHover` return value; nothing reads them anymore. Spreading `hover.handlers` onto the list keeps working unchanged.
