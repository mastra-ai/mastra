---
'@mastra/core': minor
---

Make the workspace grep text-extension whitelist extensible. Added `.sas`, `.log`, and `.jsonl` to the built-in text extensions and MIME type map so they are searchable by default. Added an optional `textExtensions` option to `MastraFilesystemOptions` (exposed via `filesystem.isTextFile()`) so consumers can register additional text extensions, and the grep tool now reports how many files were skipped due to unsupported extensions in its summary.
