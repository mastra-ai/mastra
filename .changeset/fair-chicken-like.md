---
'@mastra/core': patch
---

Fixed processor-returned `systemMessages` wiping tagged system messages owned by other processors (e.g. observational memory). `MessageList.replaceAllSystemMessages()` now preserves tagged buckets and only replaces the untagged bucket; returned messages whose content matches a tagged message are dropped instead of being re-added as untagged duplicates. The workflow processor adapter also returns the canonical `messageList.getAllSystemMessages()` to chained steps so subsequent processors see the preserved tagged messages in their `args.systemMessages`.
