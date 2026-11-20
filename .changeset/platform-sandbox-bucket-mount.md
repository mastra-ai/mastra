---
'@mastra/platform-workspace': minor
'@mastra/platform': minor
---

`PlatformSandbox` can mount a project bucket at `/workspace` with the new `mountBucket` option (E2B sandboxes), so file tools and sandbox commands see the same files. The platform issues S3 keys that only work for that bucket and sandbox. Mount progress is on `sandbox.bucketMount`; if the image has no s3fs, the state is `unavailable` and the sandbox still starts.
