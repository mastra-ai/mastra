---
'@mastra/core': patch
---

Fixed LocalSandbox native isolation being unable to open /dev/null, which broke git, ssh, and shell redirections (e.g. `2>/dev/null`) inside the sandbox. On Linux, the Bubblewrap backend now mounts a fresh /dev with standard device nodes, emitted after all configured binds so existing workarounds like `readOnlyPaths: ['/dev']` no longer shadow it. On macOS, the Seatbelt profile now allows writing to the standard device nodes (/dev/null, /dev/zero, /dev/random, /dev/urandom, /dev/tty). Fixes https://github.com/mastra-ai/mastra/issues/22702
