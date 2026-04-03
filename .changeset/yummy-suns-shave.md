---
'mastra': patch
---

Fixed mastra dev orphaning the child server process on exit. When pressing Ctrl+C or closing a terminal, the child Node.js server process is now properly awaited before the parent exits, preventing port conflicts (EADDRINUSE) on the next restart. Also added a SIGHUP handler so closing a terminal tab or IDE window correctly stops the child server. Hot-reload restarts now also await the old process exit before starting the new server. Fixes #15021.
