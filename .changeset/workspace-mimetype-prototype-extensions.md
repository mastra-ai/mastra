---
'@mastra/core': patch
---

Fix workspace `read_file` throwing `TypeError: mimeType.startsWith is not a function` for files whose extension matches an inherited `Object.prototype` member (e.g. `file.constructor`, `file.__proto__`). `getMimeType` now only resolves own string entries of its MIME table, so these filenames fall back to `application/octet-stream` and read as text like any other unknown extension. Fixes #23957.
