---
'@mastra/playground-ui': patch
---

Dropdown menus and hover cards no longer jump to the top-left corner or drift across the screen when their trigger is hidden or resized while the popup is open. Positioners now honour Floating UI's hidden-anchor state, and `MainSidebar.NavLink` accepts a `ref` so callers can anchor popups to the stable row box instead of a control that comes and goes on hover.
