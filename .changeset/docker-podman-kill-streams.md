---
'@mastra/docker': patch
---

Fixed `kill()` failing silently on Podman. The process kill helper now attaches its output streams, which Podman's Docker-compatible API requires, so timeouts, aborts and background process kills stop the process group on both Docker and Podman.
