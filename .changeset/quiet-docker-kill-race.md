---
'@mastra/docker': patch
---

Fixed a spurious `kill(...) failed unexpectedly` warning when cancelling a command that had just finished on its own. If the command has already exited, `kill()` now returns `false` quietly and the normal exit result is kept. Real failures to stop a running command are still logged.
