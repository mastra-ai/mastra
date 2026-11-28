---
'@mastra/daytona': patch
---

Recover automatically when a cached Daytona sandbox has been auto-archived and lost its runner. Commands now fail with a "does not have a runner" validation error instead of the not-found errors we already treated as sandbox-dead, so the retry path never woke the sandbox. That pattern is now classified as a dead-sandbox error, so the existing retry reuses the same sandbox ID and resumes execution transparently.
