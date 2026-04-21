---
'@mastra/server': patch
---

Projects are now scoped to their author. When the server is configured with a `MastraAuthProvider`, `GET /projects` only returns projects owned by the current user, and all project read/write routes (`GET`, `PATCH`, `DELETE`, invite/remove agent, task CRUD) reject non-authors with `403 Forbidden`. `POST /projects` automatically stamps the current user's id onto the new project. Setups with no auth provider are unaffected.
