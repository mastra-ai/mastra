---
'@mastra/daytona': patch
---

Fixed Daytona GCS mounts ignoring the `prefix` option. Mounting a bucket with a prefix now scopes the mount to that subdirectory via gcsfuse `--only-dir`, so writes land under the prefix and sandboxes mounting the same bucket with different prefixes are isolated from each other.

Before, every GCS mount used the bucket root regardless of prefix:

```ts
await sandbox.mount(
  new GCSFilesystem({ bucket: 'my-bucket', prefix: 'a/b/threadA', credentials }),
  '/gcs-data',
);
await sandbox.executeCommand('bash', ['-lc', 'echo hi > /gcs-data/probe.txt']);
// Before: object lands at gs://my-bucket/probe.txt
// After:  object lands at gs://my-bucket/a/b/threadA/probe.txt
```
