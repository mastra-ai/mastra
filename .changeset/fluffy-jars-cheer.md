---
'mastracode': minor
---

Share project resourceId construction between the TUI and the web app, so you can start a session in the terminal and continue it on the web (and vice versa).

The web app previously minted a random `project-<uuid>` resourceId per project, which never lined up with the terminal's deterministic, git-aware id. The web server now exposes `GET /api/web/project/resolve?path=...`, which runs the same `detectProject` logic the terminal uses (git-URL/repo-root based, with `MASTRA_RESOURCE_ID` and `.mastracode/database.json` overrides honored identically). The web picker resolves and stores that resourceId on each project, so opening the same folder in the terminal and the web app maps to the same session — and therefore the same threads. Projects created before this change re-resolve their resourceId on next selection.
