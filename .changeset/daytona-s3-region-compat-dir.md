---
'@mastra/daytona': patch
---

Fixed S3 mounts in Daytona sandboxes for buckets outside `us-east-1` and for prefixes without a placeholder object. The s3fs mount now passes the configured region for request signing and enables `compat_dir` when a `prefix` is set.
