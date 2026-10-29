---
'@mastra/factory': minor
---

Factory boards are now stored per project in the database. On startup, and when a project is first loaded, Factory writes the built-in Work and Review boards and the boards you pass to `new MastraFactory({ boards })` into each project. From then on Factory reads every project's boards from the database, so each project can have its own version of a board.

Existing apps need no change: a project's stored boards match your code until someone edits them. When you change a board in code, projects whose copy nobody edited pick up the new version on the next start. A project whose copy was edited keeps the edit, and the board catalog (`GET /web/factory/projects/:id/boards`) reports that the code changed. The catalog now also says where each board came from (`builtin`, `app` or `stored`) and whether it was edited.
