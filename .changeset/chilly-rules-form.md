---
'@mastra/core': patch
---

Fix workspace filesystem reads failing when filenames contain Unicode whitespace.

When a filename on disk contains a non-ASCII whitespace character (for example
`U+202F` narrow no-break space, used in macOS screenshot filenames like
`Screenshot 2026-05-13 at 3.03.11 PM.png`), models often echo the path back
with a regular ASCII space. Previously this caused `read_file`, `stat`, and
other path-based tools to fail with `FileNotFoundError`.

`LocalFilesystem.readFile` and `LocalFilesystem.stat` now retry once with a
Unicode-whitespace-aware lookup against the file's parent directory. The
fallback only fires when the original path misses and the basename contains
an ASCII space, so there's no overhead on normal reads. If more than one
sibling matches under fold (ambiguous case), the original `FileNotFoundError`
is preserved. Containment checks still run on the resolved path.
