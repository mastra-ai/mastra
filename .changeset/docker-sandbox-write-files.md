---
'@mastra/docker': minor
---

Implement the optional `writeFiles()` bulk upload API on `DockerSandbox`.

You can now upload multiple files to a running Docker sandbox in a single call instead of relying on host bind mounts or shell writes:

```ts
await sandbox.writeFiles([
  { path: 'src/index.js', content: 'console.log("hello")' },
  { path: 'data.json', content: Buffer.from('{"count":1}') },
]);
```

Files are uploaded in one operation using Docker's native archive transfer (`container.putArchive`). Relative paths resolve against the sandbox `workingDirectory`, absolute paths are honored as-is, missing parent directories are created automatically, existing files are overwritten, and both `string` and `Buffer` contents are preserved. New files are created with mode `0644`. The upload is not atomic across files: if it fails, the promise rejects and partially written files may remain. Calling `writeFiles()` before the sandbox has started throws `SandboxNotReadyError`.
