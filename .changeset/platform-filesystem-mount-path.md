---
'@mastra/platform-workspace': patch
---

`PlatformFilesystem` accepts a `mountPath` option. Paths under it map to the bucket root, so `/workspace/a.txt` and `a.txt` name the same object when the bucket is mounted at `/workspace` in the sandbox. `BUCKET_MOUNT_PATH` is exported for this.
