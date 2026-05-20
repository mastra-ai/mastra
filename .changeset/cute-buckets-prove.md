---
'@mastra/playground-ui': patch
---

Fixed a crash in filter menus with nested submenus (such as the Filter on the Agent review page) that showed "`MenuPortal` must be used within `Menu`". The submenu content now uses the design system's `DropdownMenu.SubContent` instead of the underlying library's portal directly.
