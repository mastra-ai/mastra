---
'@mastra/docker': patch
---

Fixed `kill()` on Podman. Before, `kill()` returned `false` and the process group kept running, so command timeouts, aborts and background process kills had no effect. The kill helper now attaches its output streams, which Podman's Docker-compatible API requires. Kills now stop the process group on both Docker and Podman.
