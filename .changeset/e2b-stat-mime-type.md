---
'@mastra/e2b': patch
'@mastra/platform-workspace': patch
---

Fixed `read_file` returning images and PDFs from an E2B or platform sandbox as garbled text. The sandbox filesystem's `stat()` now reports a `mimeType` for files, inferred from the extension like `LocalFilesystem`, so `read_file` returns images and PDFs as media the model can view. Directories still have no `mimeType`.
