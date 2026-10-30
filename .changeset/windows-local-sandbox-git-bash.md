---
'@mastra/core': patch
---

Fixed `LocalSandbox.executeCommand(command, args)` on native Windows. Arguments are quoted for a POSIX shell, but commands ran through `cmd.exe`, so paths like `C:\Users\First Last\repo` were split or kept their quote characters, and tools like `mkdir -p` and `find` resolved to Windows builtins. Argv commands, including `sh -c` scripts, now run through Git Bash, found via `MASTRA_WINDOWS_SHELL`, next to `git.exe` on `PATH`, or at `%ProgramFiles%\Git\bin\bash.exe`. Fixes #28866.
