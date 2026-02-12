---
'@mastra/s3': patch
---

Added optional `onInit` and `onDestroy` lifecycle callbacks to `S3FilesystemOptions`.

```ts
const fs = new S3Filesystem({
  bucket: 'my-bucket',
  region: 'us-east-1',
  onInit: ({ filesystem }) => {
    console.log('S3 filesystem ready:', filesystem.status);
  },
  onDestroy: ({ filesystem }) => {
    console.log('S3 filesystem shutting down');
  },
});
```
