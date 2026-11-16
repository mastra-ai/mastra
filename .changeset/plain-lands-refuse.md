---
'mastra': patch
---

Improved how fast the Factory sidebar opens on projects with many sessions. The sidebar now asks the server for the sessions it shows, five per group with **Show more** for the rest, instead of downloading every session and every card that holds one. Sorting, grouping and filters run on the server, and reopening the sidebar when nothing changed downloads almost nothing.
