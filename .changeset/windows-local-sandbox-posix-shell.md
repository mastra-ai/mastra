---
'@mastra/core': patch
---

Fixed `LocalSandbox` on native Windows breaking commands run with `executeCommand(command, args)`. Arguments are quoted for a POSIX shell, but they were run through `cmd.exe`, so any path with a backslash or space failed, and Factory's local sandbox could not clone repositories. These commands now run through Git Bash, found via `MASTRA_WINDOWS_SHELL`, the Git for Windows install on `PATH`, or `%ProgramFiles%\Git\bin\bash.exe`. Plain command strings still use `cmd.exe` unless `MASTRA_WINDOWS_SHELL` is set.
