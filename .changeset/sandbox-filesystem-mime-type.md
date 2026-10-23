---
'@mastra/code-sdk': patch
---

Fixed `read_file` returning images and PDFs as text when the workspace uses `SandboxFilesystem`. `SandboxFilesystem.stat()` now reports `mimeType` for files, so PNG, JPEG, WebP and PDF files reach the model as native media, the same as with `LocalFilesystem`. When the sandbox has its own filesystem, a MIME type it supplies is kept and is only inferred from the extension when missing. Directories never get a file MIME type. Shell-backed `stat()` also follows symlinks to their target, so a symlink reports its target's type and size. Fixes #28264.
