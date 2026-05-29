---
'@mastra/core': patch
---

Fixed processor-returned `systemMessages` wiping tagged system messages owned by other processors (e.g. observational memory). Processor `args.systemMessages` now exposes only the untagged system message bucket, so tagged messages owned by other processors are no longer round-tripped through the replacement API. `MessageList.replaceAllSystemMessages()` replaces only the untagged bucket and leaves tagged buckets intact. Final model input still receives both via `messageList.getAllSystemMessages()`.
