---
'@mastra/core': patch
---

Fixed read-only filesystems mounted into a natively isolated `LocalSandbox` being writable from shell commands. Commands can now read a `readOnly: true` `LocalFilesystem` mount but can't write to it under `seatbelt` or `bwrap` isolation. Mounting a read-only filesystem whose source doesn't exist now fails instead of leaving the mount writable.

Added `nativeSandbox.denyWritePaths` to block writes to specific paths, including paths inside the workspace or a `readWritePaths` entry:

```ts
const sandbox = new LocalSandbox({
  workingDirectory: '/path/to/workspace',
  isolation: 'seatbelt',
  nativeSandbox: { denyWritePaths: ['/path/to/workspace/config'] },
});
```

A custom `seatbeltProfilePath` file or `bwrapArgs` replaces the generated policy and must deny these writes itself.
