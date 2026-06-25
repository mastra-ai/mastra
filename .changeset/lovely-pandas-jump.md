---
'mastracode': patch
---

Make project selection in MastraCode web a first-class flow. Previously, adding and switching projects was buried in the sidebar and the folder picker rendered as a cramped sidebar popover. Project management is now an app-level modal (like Settings): it lists your projects with active state and remove, and embeds a themed directory browser with breadcrumb navigation for adding one. The modal opens from the header (which now shows the active project and acts as a switcher), from the sidebar's project area, and automatically on first run when no project exists yet. The no-project welcome screen gained an "Open a project" button. Projects continue to persist in localStorage and resolve the same resourceId as the terminal.
