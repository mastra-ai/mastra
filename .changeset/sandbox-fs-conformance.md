---
'@mastra/code-sdk': patch
---

Run the shared workspace filesystem conformance suite against SandboxFilesystem and fix the gaps it found: typed FileNotFoundError/FileExistsError/IsDirectoryError errors, reading a directory as a file now rejects, moveFile/copyFile create the destination parent directory, filesystem ids are unique per workdir when one sandbox backs multiple worktrees, and getInfo reports status.
