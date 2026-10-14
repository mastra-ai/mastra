---
'mastra': patch
---

Each session list in the Factory sidebar (Work, Review and User Sessions) now has one Properties menu on its heading, with Sort and the list's filters as submenus. Each row shows its current value.

- Work and Review Sessions sort by Activity (the previous order), Last updated or Last created. The Owner filter moved from the heading icon into the menu.
- User Sessions sort by Last updated (the new default) or Last created. Pinned sessions stay first. The viewer's own sessions are no longer moved to the top, because the Owner filter already starts on Mine.
- Owner, Status and Updated filters for User Sessions moved from the filter popover into the menu. Session text search was removed; global search (⌘K) already finds sessions by title, branch and id.
- The sort is remembered per list across reloads. Filters still reset on reload.
- Reset to default restores the sort and the filters together.
