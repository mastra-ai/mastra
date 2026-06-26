---
'@mastra/core': patch
---

Fixed Studio failing to boot in the browser with `TypeError: os.tmpdir is not a function`. The local sandbox resolved its mount marker directory at module-load time via `os.tmpdir()`, which crashed the client bundle where `node:os` has no `tmpdir`. The directory is now resolved lazily, so importing the Agent runtime in the browser no longer throws.
