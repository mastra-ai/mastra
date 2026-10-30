---
'@mastra/factory': patch
---

Fixed shell commands that exit with a failure code reading as successful in the Factory transcript. The command now reads as failed while the run streams and after a reload. Stopping a process with `kill_process` still reads as a success.

A system reminder that loads project instructions now reads "Project instructions" and names the file it loaded, such as `core/AGENTS.md`, instead of a bare "System reminder".
