---
'@mastra/daytona': patch
---

Pass `--implicit-dirs` to gcsfuse in Daytona GCS mounts. Without it, objects written directly to the bucket via the GCS API (no placeholder "directory" object) are unreachable in the mount — not listed and not readable by full path. This is common when the mount reads bucket contents produced by another process (SDK uploads, other services, gsutil).
