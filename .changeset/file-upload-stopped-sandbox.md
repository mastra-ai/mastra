---
'@mastra/core': patch
---

Fixed `FileUploadProcessor` and `UnsupportedFileHandler` starting a stopped sandbox just to check whether a file from the thread history is still there. A stopped sandbox keeps its files, so the turn now points the model at the file's path without resuming the sandbox, and a file lost with a sandbox that was recycled is written again on the next turn that runs with a live sandbox.
