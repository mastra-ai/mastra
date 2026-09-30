---
'@mastra/e2b': patch
---

Fixed S3 mounts ignoring `sessionToken`, so temporary AWS credentials (for example from STS AssumeRole) now work. Previously only permanent access keys could mount a bucket. ([#25563](https://github.com/mastra-ai/mastra/issues/25563))
