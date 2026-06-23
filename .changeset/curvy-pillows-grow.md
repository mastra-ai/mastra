---
'mastracode': patch
---

Replace the web project picker's broken folder selection with a server-driven directory browser.

The old picker used the browser's File System Access API, which only exposes a directory's *name* — never its absolute path — so it fell back to asking the user to hand-type the full absolute path. The web server already has filesystem access, so it now exposes `GET /api/web/fs/list` (confined to a configurable root, default `$HOME`) and the picker browses real directories and returns true absolute paths with no typing.

Also splits the web build output so the compiled server (`dist/web/server.js`) and the Vite UI (`dist/web/ui/`) no longer clobber each other, fixing static UI serving under `mastracode web`.
