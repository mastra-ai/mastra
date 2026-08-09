---
'@mastra/core': patch
---

fix(run-command-tool): normalize path containment to POSIX separators for cross-platform security

`isPathAllowed` used `startsWith(base + '/')` which on Windows produced `C:\projects/` — comparisons against backslash-normalized paths like `C:\projects\sub` always failed, silently rejecting all legitimate working directories. `extractBaseCommand` only split on `/`, letting Windows paths like `C:\tools\git.exe` escape the allowlist and blocklist (the full path was treated as the base command name instead of extracting `git.exe`).

Both sides of `isPathAllowed` now normalize to POSIX forward slashes before comparison. `extractBaseCommand` splits on both `/` and `\`. Added explicit `..` traversal rejection. Added unit tests for cross-platform path containment, command extraction, and traversal guarding.
