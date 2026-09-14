---
'@mastra/s3': patch
---

Fixed S3 filesystem initialization with prefix-restricted credentials by checking the configured prefix instead of the whole bucket. Prefixed filesystems require permission to list that prefix.
