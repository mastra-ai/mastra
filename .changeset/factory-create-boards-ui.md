---
'@mastra/factory': minor
'mastra': minor
---

Added creating, editing and deleting boards in the Factory UI. Organization admins get **New board** in the sidebar's Boards section and in **Settings → Boards** (formerly "Work board"), and **Edit board** on every board.

A new board starts from Backlog → Doing → Done or from a copy of an existing board. Its key is derived from the name and can be changed before the board is created. The editor that already edited the Work board now edits any board, and also adds, removes and reorders phases, sets each phase's kind, and edits the board's description. Boards the project or the app added can be deleted once no card sits on them; Work can only be reset.

Cards still reach a new board through intake routes, so the form links to **Settings → Work Intake**.
