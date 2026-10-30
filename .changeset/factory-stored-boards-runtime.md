---
'@mastra/factory': minor
---

Each project's boards are now the built-in Work and Review boards and the boards you pass to `new MastraFactory({ boards })`, followed by any boards the project created for itself, which are stored in its database. Code boards are served exactly as your code defines them, are never written to the database, and are read-only. When a stored board has the same key as a code board, the code board wins.

Existing apps need no change, and Factory writes nothing to the database at startup.

The board catalog (`GET /web/factory/projects/:id/boards`) now reports each board's `source` (`builtin`, `app` or `stored`), whether it is `editable` (`false` for code boards) and any `problems`, such as a runner skill that does not exist.
