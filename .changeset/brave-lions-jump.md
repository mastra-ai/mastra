---
'@mastra/core': patch
---

Fix LocalSandbox native isolation being unable to open `/dev/null`, which broke `git`, `ssh`, and ordinary shell redirections inside the sandbox. The Bubblewrap backend now mounts a fresh `/dev` (`--dev /dev`), and the macOS Seatbelt profile grants `file-write-data` on the standard device nodes so opening them read-write no longer falls through to the default deny.
