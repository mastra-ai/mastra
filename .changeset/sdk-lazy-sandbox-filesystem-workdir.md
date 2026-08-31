---
'@mastra/code-sdk': minor
---

`SandboxFilesystem` accepts a lazy `workdir` — a resolver function awaited on the first file operation and memoized — for sandboxes whose workspace root is only knowable once the VM is running (repos clone into the VM's own home dir). `basePath` reports empty and `resolveAbsolutePath` returns undefined until the root resolves; a failed resolution is not memoized, so the next operation retries.
