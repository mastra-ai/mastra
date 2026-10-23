---
'@mastra/code-sdk': patch
'@mastra/core': patch
---

Fixed `read_file` returning images and PDFs as text when the workspace uses `SandboxFilesystem`. `SandboxFilesystem.stat()` now reports `mimeType` for files, so PNG, JPEG, WebP and PDF files reach the model as native media, the same as with `LocalFilesystem`. When the sandbox has its own filesystem, a MIME type it supplies is kept and is only inferred from the extension when missing. Directories never get a file MIME type. Fixes #28264.

`@mastra/core/workspace` now exports `getMimeType`, the extension-based lookup `LocalFilesystem` uses, so custom filesystem providers can fill in `FileStat.mimeType` the same way.

```ts
import { getMimeType } from '@mastra/core/workspace';

getMimeType('page.png'); // 'image/png'
getMimeType('notes.unknown'); // 'application/octet-stream'
```
