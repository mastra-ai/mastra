---
'@mastra/gcs': patch
---

Added optional `onInit` and `onDestroy` lifecycle callbacks to `GCSFilesystemOptions`.

```ts
const fs = new GCSFilesystem({
  bucket: 'my-bucket',
  projectId: 'my-project',
  onInit: ({ filesystem }) => {
    console.log('GCS filesystem ready:', filesystem.status);
  },
  onDestroy: ({ filesystem }) => {
    console.log('GCS filesystem shutting down');
  },
});
```
