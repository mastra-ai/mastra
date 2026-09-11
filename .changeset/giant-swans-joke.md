---
'@mastra/code-sdk': patch
---

The sandbox-backed workspace filesystem now runs `list_files` tree walks and `grep` searches inside the sandbox in a single command (using `find` and `rg`/`grep`), instead of one round trip per directory and file. `walk()` throws `DirectoryNotFoundError` / `NotDirectoryError` for a missing or non-directory root and reports symlink targets. Ripgrep results are kept when `rg` exits with a per-file error (for example an unreadable file) instead of being discarded, and patterns whose meaning differs between POSIX ERE and JavaScript regex (`[[:digit:]]`, `\<`, `\>`) fall back to the host-side search so match columns stay correct.
