---
'@mastra/core': patch
---

`write_file` now names the real file location when the filesystem maps an absolute path somewhere else. In a Factory sandbox, writing `/tmp/x` stores the file at `<workspace>/tmp/x`; the tool result now says `Wrote 5 bytes to /tmp/x (resolved to <workspace>/tmp/x)` so follow-up shell commands look in the right place. Fixes #28862.
