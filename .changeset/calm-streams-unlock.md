---
'@mastra/core': patch
---

Fixed a process crash with `TypeError: Invalid state: ReadableStream is locked` after a provider errored mid-stream. The crash happened when an agent had output processors, such as `BatchPartsProcessor` or `RegexFilterProcessor`, and a retrying error processor, such as `StreamErrorRetryProcessor`. Output processors no longer carry buffered parts across the retry. A stream that is already being read now reports through `onError` instead of raising an unhandled rejection, which on Node 22 exited the process and dropped every in-flight run.
