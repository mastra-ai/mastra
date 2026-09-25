---
'@mastra/core': patch
---

Fixed `LocalFilesystem` with `contained: true` allowing new files and directories to be created outside `basePath` through a symlinked ancestor directory.

Previously only operations on _existing_ outside targets were rejected. Creating a new file or directory through a symlink pointing outside the root succeeded, via `writeFile`, `appendFile`, `mkdir`, `copyFile`, `moveFile` and the native `write_file` / `mkdir` workspace tools. Containment is now checked against where the path would actually be created — resolved through the nearest existing ancestor and through dangling symlinks — so these operations are rejected with a `PermissionError`. Symlinks whose target is in `allowedPaths` continue to work.

**Hardened file writes against concurrent symlink swaps**

`writeFile` and `appendFile` now verify the opened file descriptor belongs to a permitted path before truncating or writing. A symlink replaced between the containment check and the write can no longer redirect content outside the root or overwrite an outside file. Directory creation, copy, move and delete remain check-then-act; the documentation now states this explicitly.

**Recursive `readdir` no longer fails on escaping symlinks**

Listing a directory recursively used to throw `PermissionError` if any entry was a symlink pointing outside the root. Such entries are now listed but not followed.
