---
'mastracode': patch
---

Fix the web app not showing any threads after reopening. The app loaded the
saved project list but always reset the active project to none on reload, so
the session stayed dormant and never listed its threads — you had to re-select
the project every time. The last active project is now persisted and restored
on load (and its TUI-compatible resourceId is backfilled if needed), so the
session reconnects automatically and its threads reappear. Removing the active
project clears the saved selection.
