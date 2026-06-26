---
'@mastra/e2b': patch
---

Make concurrent S3 and GCS mounts reliable in the same sandbox

Mounting several buckets at once, or restoring mounts after a pause/resume, could previously fail or pick up the wrong credentials because every mount shared one temporary credentials file and overwrote each other's. Each mount now gets its own credentials file, so they no longer interfere. (Azure already worked this way.)
