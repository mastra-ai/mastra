---
'@mastra/core': patch
---

Only emit the "logger already wired to another Mastra instance" re-attach warning when `loggerOptions.export` is enabled. With `export: false` there is no observability export target to clobber, so attaching a shared logger to multiple `Mastra` instances no longer prints a spurious warning.
