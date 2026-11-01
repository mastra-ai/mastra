---
'@mastra/factory': patch
---

Fixed shell commands that exit with a failure code reading as successful in the Factory transcript. The command now reads as failed while the run streams and after a reload. Stopping a process with `kill_process` still reads as a success.

A system reminder that loads project instructions (`AGENTS.md`, `CLAUDE.md` or `CONTEXT.md`) now reads "Project instructions" and names the file by its path in the working directory, such as `packages/core/AGENTS.md`, instead of a bare "System reminder".
