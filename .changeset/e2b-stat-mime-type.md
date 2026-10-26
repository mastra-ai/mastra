---
'@mastra/e2b': patch
'@mastra/platform-workspace': patch
'@mastra/agentfs': patch
'@mastra/modal': patch
'@mastra/mesa': patch
'@mastra/e2b-desktop': patch
---

Fixed `read_file` returning images and PDFs from E2B, platform, AgentFS, Modal and Mesa filesystems as garbled text. Their `stat()` now reports a `mimeType` for files, inferred from the extension with `getMimeType` from `@mastra/core/workspace` like `LocalFilesystem`, so `read_file` returns supported images (PNG, JPEG, WebP) and PDFs as media the model can view. Directories still have no `mimeType`.

These packages now require `@mastra/core` 1.80.0 or later, the first release that exports `getMimeType`.
