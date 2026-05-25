---
'@mastra/playground-ui': patch
---

Removed the remaining Radix UI runtime dependencies from Playground UI while preserving the SideDialog, MainSidebar, and accessibility helper behavior. SideDialog now uses the Drawer primitive so nested levels share the drawer stacking behavior.
