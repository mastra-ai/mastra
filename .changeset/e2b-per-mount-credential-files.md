---
'@mastra/e2b': patch
---

Fix concurrent S3/GCS mounts racing on a shared credentials file

`mountS3` and `mountGCS` wrote credentials to a single fixed path
(`/tmp/.passwd-s3fs`, `/tmp/gcs-key.json`) and rewrote it (`rm` → `write` →
`chmod`) on every mount. When two mounts run concurrently in the same sandbox
(e.g. mounting several buckets, or re-establishing mounts after a pause/resume),
their rewrites interleave — one mount's `write`/`chmod` races another's `rm` —
causing `EACCES` and a failed mount, or a mount reading another mount's
credentials. Each mount now derives a per-mount path from a hash of its mount
point (the same approach `mountAzure` already uses), removing the shared
resource. Azure was already unaffected.
