---
'@mastra/gcs': patch
'@mastra/s3': patch
---

Fixed `mkdir()` on Google Cloud Storage and S3 workspaces. An empty directory is now created and stays visible to `readdir()`, `exists()` and `stat()` until you remove it with `rmdir()`.

**Related fixes**

- `readdir()` reports a nested directory as its first path segment. After `mkdir('/a/b')`, `readdir('/')` returns one entry named `a`.
- A listing with `recursive` and `extension` returns files only. Directories no longer pass the extension filter.
- A path with a trailing slash always means a directory. `stat('/x/')` and `isFile('/x/')` no longer match a file named `x`, and `readFile('/x/')` throws `FileNotFoundError` instead of returning empty content.
- `mkdir()` works with a credential that can write but not read.
