---
"@mastra/core": patch
---

Fixed Windows shell command execution to avoid visible cmd.exe window popups and broken stdout/stderr piping. On Windows, `LocalProcessManager` no longer uses `detached: true` (which caused console window popups), and process tree killing uses `taskkill /T` via execa instead of Unix process groups.
