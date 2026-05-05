---
'@mastra/e2b': patch
---

Fixed silent S3 mount failures in E2B sandboxes.

The s3fs region option is now passed correctly so signature-version-4 requests match buckets outside `us-east-1` (Supabase, AWS S3 in non-default regions, etc). When s3fs daemonizes successfully but its FUSE init bucket check fails afterwards, Mastra now verifies the mountpoint and surfaces a clear error instead of reporting a successful mount.

**Before**

```ts
new Workspace({
  mounts: {
    '/skills': new S3Filesystem({
      bucket: 'skills',
      region: 'ap-northeast-1', // ignored by s3fs — defaulted to us-east-1
      endpoint: 'https://<project>.storage.supabase.co/storage/v1/s3',
      accessKeyId,
      secretAccessKey,
    }),
  },
  sandbox: new E2BSandbox(),
});
// Logs: 'Mount successful' — but ls /skills is empty.
```

**After**

The region flows to s3fs and the mount is verified post-attach. If verification fails the workspace surfaces:

```
s3fs returned exit 0 but /skills is not a mountpoint. The s3fs daemon
likely failed during FUSE init (common causes: region mismatch, invalid
credentials, or an S3-compatible endpoint that rejects the signature).
Re-run inside the sandbox with '-f -o dbglevel=info' to see the underlying error.
```
